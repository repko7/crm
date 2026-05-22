const express = require('express');
const db = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
};

const PLANS = {
  pro: { price_id: process.env.STRIPE_PRO_PRICE_ID, name: 'Pro' },
  team: { price_id: process.env.STRIPE_TEAM_PRICE_ID, name: 'Team' },
};

// Create Stripe checkout session
router.post('/checkout', auth, async (req, res) => {
  const { plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' });

  try {
    const stripe = getStripe();
    const userResult = await db.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const user = userResult.rows[0];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      metadata: { user_id: req.user.id, plan },
      line_items: [{ price: PLANS[plan].price_id, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/billing/cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get subscription status
router.get('/status', auth, async (req, res) => {
  const result = await db.query(
    'SELECT subscription_plan, subscription_status, subscription_end FROM users WHERE id=$1',
    [req.user.id]
  );
  const user = result.rows[0];
  res.json({
    plan: user.subscription_plan || 'free',
    status: user.subscription_status || 'active',
    end: user.subscription_end,
  });
});

// Create billing portal session
router.post('/portal', auth, async (req, res) => {
  try {
    const stripe = getStripe();
    const result = await db.query('SELECT stripe_customer_id FROM users WHERE id=$1', [req.user.id]);
    const customerId = result.rows[0]?.stripe_customer_id;
    if (!customerId) return res.status(400).json({ error: 'No subscription found' });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL}/settings`,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: 'Webhook signature failed' });
  }

  const session = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      const { user_id, plan } = session.metadata;
      await db.query(
        `UPDATE users SET subscription_plan=$1, subscription_status='active',
         stripe_customer_id=$2 WHERE id=$3`,
        [plan, session.customer, user_id]
      );
      break;
    }
    case 'customer.subscription.deleted': {
      await db.query(
        `UPDATE users SET subscription_plan='free', subscription_status='cancelled' WHERE stripe_customer_id=$1`,
        [session.customer]
      );
      break;
    }
    case 'invoice.payment_failed': {
      await db.query(
        `UPDATE users SET subscription_status='past_due' WHERE stripe_customer_id=$1`,
        [session.customer]
      );
      break;
    }
  }

  res.json({ received: true });
});

module.exports = router;
