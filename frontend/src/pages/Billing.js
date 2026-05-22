import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../hooks/useApi';
import toast from 'react-hot-toast';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: ['100 contacts', '10 active deals', 'Basic pipeline', 'Email support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    features: ['Unlimited contacts', 'Unlimited deals', 'AI Assistant', 'Gmail & Outlook sync', 'Priority support'],
    highlight: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: 79,
    features: ['Everything in Pro', 'Up to 10 users', 'Team analytics', 'Custom fields', 'Dedicated support'],
  },
];

export default function Billing() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(null);

  useEffect(() => {
    api.get('/billing/status').then(r => setStatus(r.data)).catch(() => {});
  }, []);

  const subscribe = async planId => {
    if (planId === 'free') return;
    setLoading(planId);
    try {
      const { data } = await api.post('/billing/checkout', { plan: planId });
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Billing not configured yet');
      setLoading(null);
    }
  };

  const openPortal = async () => {
    try {
      const { data } = await api.post('/billing/portal');
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Portal not available');
    }
  };

  const currentPlan = status?.plan || 'free';

  return (
    <div className="p-8 max-w-5xl">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Billing & Plans</h2>
      <p className="text-slate-500 mb-8">Manage your subscription</p>

      {status && (
        <div className="card mb-8 flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">Current plan</div>
            <div className="text-xl font-bold text-slate-800 capitalize mt-1">{currentPlan}</div>
            {status.status === 'past_due' && (
              <div className="text-red-500 text-sm mt-1">Payment overdue — update your payment method</div>
            )}
          </div>
          {currentPlan !== 'free' && (
            <button className="btn-secondary" onClick={openPortal}>Manage Subscription</button>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {plans.map(plan => {
          const isCurrent = currentPlan === plan.id;
          return (
            <div key={plan.id} className={`rounded-2xl p-8 border-2 transition-all
              ${isCurrent ? 'border-blue-500 bg-blue-50' : plan.highlight ? 'border-blue-200 bg-white shadow-md' : 'border-slate-200 bg-white'}`}>
              {isCurrent && (
                <div className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-3">Current Plan</div>
              )}
              <h3 className="text-lg font-bold text-slate-800 mb-1">{plan.name}</h3>
              <div className="text-4xl font-extrabold text-slate-900 mb-1">${plan.price}</div>
              <div className="text-sm text-slate-400 mb-6">per month</div>
              <ul className="space-y-2.5 mb-8">
                {plan.features.map(f => (
                  <li key={f} className="text-sm text-slate-600 flex items-center gap-2">
                    <span className="text-green-500 font-bold">✓</span> {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="block text-center py-2.5 rounded-lg font-medium bg-blue-100 text-blue-600">
                  Active
                </div>
              ) : (
                <button
                  onClick={() => subscribe(plan.id)}
                  disabled={!!loading}
                  className="w-full btn-primary py-2.5">
                  {loading === plan.id ? 'Redirecting...' : plan.price === 0 ? 'Downgrade' : 'Upgrade'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="card mt-8 bg-amber-50 border-amber-100">
        <h4 className="font-medium text-amber-800 mb-2">Setup Required</h4>
        <p className="text-sm text-amber-700">
          Add <code className="bg-amber-100 px-1 rounded">STRIPE_SECRET_KEY</code>,{' '}
          <code className="bg-amber-100 px-1 rounded">STRIPE_PRO_PRICE_ID</code>, and{' '}
          <code className="bg-amber-100 px-1 rounded">STRIPE_WEBHOOK_SECRET</code> to backend <code className="bg-amber-100 px-1 rounded">.env</code> to enable payments.
        </p>
      </div>
    </div>
  );
}
