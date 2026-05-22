import React, { useEffect, useState } from 'react';
import api from '../hooks/useApi';
import toast from 'react-hot-toast';
import { format, isPast } from 'date-fns';

const EMPTY = { message: '', remind_at: '', channel: 'email', contact_id: '', deal_id: '' };

export default function Reminders() {
  const [reminders, setReminders] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = () => {
    Promise.all([
      api.get('/reminders'),
      api.get('/contacts'),
      api.get('/deals'),
    ]).then(([r, c, d]) => {
      setReminders(r.data);
      setContacts(c.data);
      setDeals(d.data);
    });
  };

  useEffect(() => { load(); }, []);

  const save = async e => {
    e.preventDefault();
    await api.post('/reminders', form);
    toast.success('Reminder set!');
    setModal(false);
    load();
  };

  const del = async id => {
    await api.delete(`/reminders/${id}`);
    load();
  };

  const set = f => e => setForm(prev => ({ ...prev, [f]: e.target.value }));
  const pending = reminders.filter(r => !r.sent);
  const sent = reminders.filter(r => r.sent);

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reminders</h2>
          <p className="text-slate-500 text-sm mt-1">{pending.length} pending</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(EMPTY); setModal(true); }}>
          + Set Reminder
        </button>
      </div>

      {pending.length > 0 && (
        <div className="space-y-3 mb-8">
          {pending.map(r => {
            const overdue = isPast(new Date(r.remind_at));
            return (
              <div key={r.id} className={`card flex items-start gap-4 ${overdue ? 'border-orange-200 bg-orange-50' : ''}`}>
                <div className={`text-2xl ${overdue ? '' : 'opacity-60'}`}>
                  {r.channel === 'email' ? '📧' : '🔔'}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-800">{r.message}</div>
                  <div className="flex gap-3 mt-1 text-sm">
                    {r.contact_name && <span className="text-slate-400">👤 {r.contact_name}</span>}
                    {r.deal_title && <span className="text-slate-400">💼 {r.deal_title}</span>}
                    <span className={overdue ? 'text-orange-600 font-medium' : 'text-slate-400'}>
                      {overdue ? 'Due ' : ''}
                      {format(new Date(r.remind_at), 'MMM d, yyyy HH:mm')}
                      {overdue && ' (overdue)'}
                    </span>
                  </div>
                </div>
                <button onClick={() => del(r.id)} className="text-red-400 hover:text-red-600 text-sm">Delete</button>
              </div>
            );
          })}
        </div>
      )}

      {sent.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">Sent</h3>
          <div className="space-y-2">
            {sent.map(r => (
              <div key={r.id} className="card flex items-center gap-4 opacity-50 py-3">
                <span className="text-slate-300 text-lg">✓</span>
                <div className="flex-1 text-sm text-slate-500">{r.message}</div>
                <span className="text-xs text-slate-400">{format(new Date(r.remind_at), 'MMM d')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {reminders.length === 0 && (
        <div className="card text-center py-16">
          <div className="text-4xl mb-3">⏰</div>
          <p className="text-slate-400">No reminders yet. Set one to never miss a follow-up.</p>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">New Reminder</h3>
            <form onSubmit={save} className="space-y-3">
              <textarea className="input" placeholder="Reminder message *" rows={3}
                value={form.message} onChange={set('message')} required />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remind me at</label>
                <input className="input" type="datetime-local" value={form.remind_at}
                  onChange={set('remind_at')} required />
              </div>
              <select className="input" value={form.channel} onChange={set('channel')}>
                <option value="email">Email notification</option>
                <option value="in-app">In-app only</option>
              </select>
              <select className="input" value={form.contact_id} onChange={set('contact_id')}>
                <option value="">Link to contact (optional)</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="input" value={form.deal_id} onChange={set('deal_id')}>
                <option value="">Link to deal (optional)</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Set Reminder</button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
