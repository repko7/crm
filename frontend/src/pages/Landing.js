import React from 'react';
import { Link } from 'react-router-dom';

const features = [
  { icon: '🤖', title: 'AI Sales Coach', desc: 'Get real-time advice, draft emails, and summarize contacts automatically with GPT-4.' },
  { icon: '💼', title: 'Deal Pipeline', desc: 'Visual pipeline from prospect to close. Know exactly where every deal stands.' },
  { icon: '📧', title: 'Email Sync', desc: 'Connect Gmail or Outlook. See every conversation with a contact in one place.' },
  { icon: '✅', title: 'Smart Tasks', desc: 'Never miss a follow-up. Tasks linked to contacts and deals with reminders.' },
  { icon: '📊', title: 'Live Dashboard', desc: 'Real-time revenue forecasts, pipeline health, and team performance at a glance.' },
  { icon: '⚡', title: '5-Minute Setup', desc: 'No training needed. Import your contacts and close deals the same day.' },
];

const plans = [
  {
    name: 'Starter',
    price: 0,
    period: 'free forever',
    features: ['Up to 100 contacts', '10 active deals', 'Basic pipeline', 'Email support'],
    cta: 'Start Free',
    href: '/register',
    highlight: false,
  },
  {
    name: 'Pro',
    price: 29,
    period: 'per month',
    features: ['Unlimited contacts', 'Unlimited deals', 'AI Assistant (GPT-4)', 'Gmail & Outlook sync', 'Priority support'],
    cta: 'Start 14-Day Trial',
    href: '/register?plan=pro',
    highlight: true,
  },
  {
    name: 'Team',
    price: 79,
    period: 'per month',
    features: ['Everything in Pro', 'Up to 10 users', 'Team analytics', 'Custom fields', 'Dedicated support'],
    cta: 'Start 14-Day Trial',
    href: '/register?plan=team',
    highlight: false,
  },
];

const testimonials = [
  { name: 'Sarah K.', role: 'Founder, Growly', text: 'We closed 40% more deals in the first month. The AI email drafter alone saves me 2 hours a day.' },
  { name: 'Mike R.', role: 'Sales Lead, NexaHQ', text: 'Finally a CRM that doesn\'t require a PhD to use. Set up in 10 minutes, revenue up in 30 days.' },
  { name: 'Anna T.', role: 'CEO, Brightloop', text: 'I tried Salesforce and HubSpot. This is the first CRM my team actually uses every day.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur border-b border-slate-100 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-slate-800">CRM Pro</span>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-slate-600 hover:text-slate-800 text-sm font-medium">Sign in</Link>
            <Link to="/register" className="btn-primary text-sm">Start Free</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 text-center bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto">
          <div className="inline-block bg-blue-100 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            🚀 AI-Native CRM for small teams
          </div>
          <h1 className="text-5xl font-extrabold text-slate-900 leading-tight mb-6">
            Close more deals.<br />
            <span className="text-blue-600">Let AI do the heavy lifting.</span>
          </h1>
          <p className="text-xl text-slate-500 mb-10 max-w-2xl mx-auto">
            The only CRM that thinks like a salesperson. AI summaries, email drafts, and coaching — built in. Set up in 5 minutes.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link to="/register" className="btn-primary text-base px-8 py-3">Start Free — No Credit Card</Link>
            <a href="#pricing" className="btn-secondary text-base px-8 py-3">See Pricing</a>
          </div>
          <p className="text-sm text-slate-400 mt-4">14-day free trial on all paid plans · Cancel anytime</p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-800 text-center mb-4">Everything a small team needs</h2>
          <p className="text-slate-500 text-center mb-12">No bloat. No complexity. Just the tools that drive revenue.</p>
          <div className="grid grid-cols-3 gap-8">
            {features.map(f => (
              <div key={f.title} className="p-6 rounded-xl border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-slate-800 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-800 text-center mb-4">Simple, transparent pricing</h2>
          <p className="text-slate-500 text-center mb-12">Start free. Upgrade when you're ready to grow.</p>
          <div className="grid grid-cols-3 gap-6">
            {plans.map(p => (
              <div key={p.name} className={`rounded-2xl p-8 ${p.highlight ? 'bg-blue-600 text-white shadow-xl scale-105' : 'bg-white border border-slate-200'}`}>
                {p.highlight && <div className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-4">Most Popular</div>}
                <h3 className={`text-lg font-bold mb-1 ${p.highlight ? 'text-white' : 'text-slate-800'}`}>{p.name}</h3>
                <div className={`text-4xl font-extrabold mb-1 ${p.highlight ? 'text-white' : 'text-slate-900'}`}>
                  ${p.price}
                </div>
                <div className={`text-sm mb-6 ${p.highlight ? 'text-blue-200' : 'text-slate-400'}`}>{p.period}</div>
                <ul className="space-y-2.5 mb-8">
                  {p.features.map(f => (
                    <li key={f} className={`text-sm flex items-center gap-2 ${p.highlight ? 'text-blue-100' : 'text-slate-600'}`}>
                      <span className="text-green-400 font-bold">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link to={p.href}
                  className={`block text-center py-2.5 rounded-lg font-medium transition-colors ${p.highlight ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-800 text-center mb-12">Loved by small teams</h2>
          <div className="grid grid-cols-3 gap-6">
            {testimonials.map(t => (
              <div key={t.name} className="card">
                <p className="text-slate-600 italic mb-4">"{t.text}"</p>
                <div className="font-semibold text-slate-800 text-sm">{t.name}</div>
                <div className="text-slate-400 text-xs">{t.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-blue-600 text-white text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to close more deals?</h2>
        <p className="text-blue-100 mb-8 text-lg">Join 10,000+ small businesses that grow with CRM Pro</p>
        <Link to="/register" className="inline-block bg-white text-blue-600 font-bold px-10 py-3 rounded-lg hover:bg-blue-50 transition-colors">
          Get Started Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-100 text-center text-slate-400 text-sm">
        © 2026 CRM Pro · Built with AI · <Link to="/login" className="hover:underline">Sign in</Link>
      </footer>
    </div>
  );
}
