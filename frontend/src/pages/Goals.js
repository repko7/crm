import React, { useEffect, useState } from 'react';
import api from '../hooks/useApi';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const today = () => new Date().toISOString().slice(0, 10);
const blank = () => Array(10).fill('');

export default function Goals() {
  const [date, setDate] = useState(today());
  const [goals, setGoals] = useState([]);
  const [draft, setDraft] = useState(blank());
  const [editing, setEditing] = useState(true);
  const [dates, setDates] = useState([]);
  const [recurring, setRecurring] = useState([]);

  const isToday = date === today();

  const load = async () => {
    const [g, d, r] = await Promise.all([
      api.get(`/goals?date=${date}`),
      api.get('/goals/dates'),
      api.get('/goals/recurring')
    ]);
    setGoals(g.data);
    setDates(d.data);
    setRecurring(r.data);
    setEditing(g.data.length === 0);
    setDraft(blank());
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date]);

  const setDraftAt = (i, v) => setDraft(prev => prev.map((x, idx) => (idx === i ? v : x)));

  const save = async e => {
    e.preventDefault();
    const cleaned = draft.map(g => g.trim()).filter(Boolean);
    if (cleaned.length === 0) return toast.error('Write at least one goal');
    await api.post('/goals', { date, goals: cleaned });
    toast.success('Goals saved');
    load();
  };

  const toggle = async goal => {
    await api.put(`/goals/${goal.id}`, { achieved: !goal.achieved });
    load();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-slate-800">10 Goals — Brian Tracy Method</h2>
        {!isToday && (
          <button className="btn-secondary" onClick={() => setDate(today())}>Back to today</button>
        )}
      </div>
      <p className="text-slate-500 text-sm mb-6 max-w-2xl">
        Every day, write 10 goals from memory — first person, present tense ("I earn...", "I weigh..."),
        without looking at yesterday's list. The goals that keep repeating over the following weeks are
        your real priorities.
      </p>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-700">{format(new Date(date), 'MMMM d, yyyy')}</h3>
              {!editing && (
                <button className="text-sm text-blue-600 hover:underline" onClick={() => { setDraft(blank()); setEditing(true); }}>
                  Rewrite list
                </button>
              )}
            </div>

            {editing ? (
              <form onSubmit={save} className="space-y-2">
                {draft.map((g, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-6 text-slate-400 text-sm">{i + 1}.</span>
                    <input
                      className="input"
                      placeholder="I ..."
                      value={g}
                      onChange={e => setDraftAt(i, e.target.value)}
                    />
                  </div>
                ))}
                <div className="flex gap-3 pt-3">
                  <button type="submit" className="btn-primary">Save list</button>
                  {goals.length > 0 && (
                    <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                  )}
                </div>
              </form>
            ) : (
              <div className="space-y-2">
                {goals.map(g => (
                  <div key={g.id} className="flex items-center gap-3 py-1">
                    <input
                      type="checkbox"
                      checked={g.achieved}
                      onChange={() => toggle(g)}
                      className="w-5 h-5 rounded accent-blue-600"
                    />
                    <span className={g.achieved ? 'line-through text-slate-400' : 'text-slate-800'}>{g.text}</span>
                  </div>
                ))}
                {goals.length === 0 && <div className="text-slate-400 text-sm">No goals recorded for this day.</div>}
              </div>
            )}
          </div>

          {dates.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-slate-700 mb-3">History</h3>
              <div className="flex flex-wrap gap-2">
                {dates.map(d => {
                  const dd = typeof d === 'string' ? d.slice(0, 10) : d;
                  return (
                    <button
                      key={dd}
                      onClick={() => setDate(dd)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        dd === date ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {format(new Date(dd), 'MMM d')}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="card h-fit">
          <h3 className="font-semibold text-slate-700 mb-1">Recurring goals</h3>
          <p className="text-xs text-slate-400 mb-3">
            Goals you've written on more than one day — likely your true priorities.
          </p>
          <div className="space-y-3">
            {recurring.map(r => (
              <div key={r.normalized} className="flex items-start justify-between gap-2">
                <span className="text-sm text-slate-700">{r.text}</span>
                <span className="text-xs font-medium text-blue-600 whitespace-nowrap">{r.day_count}×</span>
              </div>
            ))}
            {recurring.length === 0 && (
              <div className="text-slate-400 text-sm">Keep writing daily — patterns will show up here.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
