const express = require('express');
const db = require('../models/db');
const auth = require('../middleware/auth');
const nodemailer = require('nodemailer');
const router = express.Router();

router.use(auth);

const getTransport = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// Get all reminders for user
router.get('/', async (req, res) => {
  const result = await db.query(
    `SELECT r.*, c.name as contact_name, d.title as deal_title
     FROM reminders r
     LEFT JOIN contacts c ON r.contact_id = c.id
     LEFT JOIN deals d ON r.deal_id = d.id
     WHERE r.user_id = $1
     ORDER BY r.remind_at ASC`,
    [req.user.id]
  );
  res.json(result.rows);
});

// Create a reminder
router.post('/', async (req, res) => {
  const { contact_id, deal_id, message, remind_at, channel } = req.body;
  if (!message || !remind_at) return res.status(400).json({ error: 'message and remind_at are required' });

  const result = await db.query(
    `INSERT INTO reminders (user_id, contact_id, deal_id, message, remind_at, channel)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.id, contact_id || null, deal_id || null, message, remind_at, channel || 'email']
  );
  res.status(201).json(result.rows[0]);
});

// Delete a reminder
router.delete('/:id', async (req, res) => {
  await db.query('DELETE FROM reminders WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

// Trigger due reminders (called by a cron job or scheduler)
// POST /api/reminders/process — internal endpoint (no user auth, uses service key)
router.post('/process', async (req, res) => {
  if (req.headers['x-service-key'] !== process.env.SERVICE_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const due = await db.query(
    `SELECT r.*, u.email as user_email, u.name as user_name,
            c.name as contact_name
     FROM reminders r
     JOIN users u ON r.user_id = u.id
     LEFT JOIN contacts c ON r.contact_id = c.id
     WHERE r.remind_at <= NOW() AND r.sent = FALSE`,
    []
  );

  const transport = getTransport();
  let sent = 0;

  for (const reminder of due.rows) {
    try {
      if (reminder.channel === 'email' && process.env.SMTP_USER) {
        await transport.sendMail({
          from: `"CRM Pro" <${process.env.SMTP_USER}>`,
          to: reminder.user_email,
          subject: `Reminder: ${reminder.message}`,
          html: `
            <div style="font-family:sans-serif;max-width:500px">
              <h2 style="color:#1e40af">CRM Pro Reminder</h2>
              <p>${reminder.message}</p>
              ${reminder.contact_name ? `<p><strong>Contact:</strong> ${reminder.contact_name}</p>` : ''}
              <p style="color:#64748b;font-size:12px">CRM Pro — Your AI Sales Assistant</p>
            </div>`,
        });
      }
      await db.query('UPDATE reminders SET sent=TRUE WHERE id=$1', [reminder.id]);
      sent++;
    } catch (err) {
      console.error(`Failed to send reminder ${reminder.id}:`, err.message);
    }
  }

  res.json({ processed: due.rows.length, sent });
});

module.exports = router;
