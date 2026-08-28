import React, { useEffect, useState } from 'react';
import api from '../hooks/useApi';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const EMPTY = { type: 'win', title: '', description: '', entry_date: format(new Date(), 'yyyy-MM-dd') };

const TYPE_META = {
  win: { label: 'Перемога', icon: '🏆', badge: 'bg-green-100 text-green-700', tab: 'Перемоги' },
  strength: { label: 'Сильна сторона', icon: '💪', badge: 'bg-blue-100 text-blue-700', tab: 'Сильні сторони' },
  weakness: { label: 'Зона росту', icon: '🌱', badge: 'bg-amber-100 text-amber-700', tab: 'Зони росту' },
};

const FILTERS = [
  { key: 'all', label: 'Усе' },
  { key: 'win', label: 'Перемоги' },
  { key: 'strength', label: 'Сильні сторони' },
  { key: 'weakness', label: 'Зони росту' },
];

export default function Confidence() {
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({ counts: { win: 0, strength: 0, weakness: 0 }, confidence_score: 0, recall: null });
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    const [e, s] = await Promise.all([
      api.get(filter === 'all' ? '/confidence' : `/confidence?type=${filter}`),
      api.get('/confidence/summary'),
    ]);
    setEntries(e.data);
    setSummary(s.data);
  };

  useEffect(() => { load(); }, [filter]);

  const save = async e => {
    e.preventDefault();
    await api.post('/confidence', form);
    toast.success('Запис додано');
    setModal(false);
    load();
  };

  const del = async id => {
    await api.delete(`/confidence/${id}`);
    load();
  };

  const set = f => e => setForm(prev => ({ ...prev, [f]: e.target.value }));

  const refreshRecall = async () => {
    const s = await api.get('/confidence/summary');
    setSummary(s.data);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Впевненість</h2>
          <p className="text-slate-400 text-sm mt-1">Пригадуй перемоги. Знай свої сильні сторони. Рости усвідомлено.</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(EMPTY); setModal(true); }}>+ Додати запис</button>
      </div>

      <div className="card mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-none">
        <p className="text-sm leading-relaxed">
          Мета — щоб ти мав(-ла) реалістичне й тверде розуміння себе: своїх цінних якостей і недоліків,
          здібностей і слабких сторін, цілей і прагнень у житті. Таке ставлення до себе вбереже від
          серйозних помилок і додасть впевненості у власних рішеннях.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="text-3xl font-bold text-green-600">{summary.counts.win}</div>
          <div className="text-sm text-slate-400 mt-1">Перемоги</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-blue-600">{summary.counts.strength}</div>
          <div className="text-sm text-slate-400 mt-1">Сильні сторони</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-amber-600">{summary.counts.weakness}</div>
          <div className="text-sm text-slate-400 mt-1">Зони росту</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-indigo-600">{summary.confidence_score}%</div>
          <div className="text-sm text-slate-400 mt-1">Рівень впевненості</div>
        </div>
      </div>

      {summary.recall && (
        <div className="card mb-6 border-green-100 bg-green-50/50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">Згадай свою перемогу 🏆</div>
              <div className="font-semibold text-slate-800">{summary.recall.title}</div>
              {summary.recall.description && (
                <p className="text-sm text-slate-500 mt-1">{summary.recall.description}</p>
              )}
              <div className="text-xs text-slate-400 mt-2">{format(new Date(summary.recall.entry_date), 'd MMMM yyyy')}</div>
            </div>
            <button onClick={refreshRecall} className="text-slate-400 hover:text-slate-600 text-sm shrink-0">↻ Інша</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f.key ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {entries.map(e => {
          const meta = TYPE_META[e.type] || TYPE_META.win;
          return (
            <div key={e.id} className="card flex items-start justify-between gap-4 py-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`badge ${meta.badge}`}>{meta.icon} {meta.label}</span>
                  <span className="text-xs text-slate-400">{format(new Date(e.entry_date), 'd MMM yyyy')}</span>
                </div>
                <div className="font-medium text-slate-800">{e.title}</div>
                {e.description && <div className="text-sm text-slate-500 mt-0.5">{e.description}</div>}
              </div>
              <button className="text-red-400 hover:text-red-600 text-sm shrink-0" onClick={() => del(e.id)}>Видалити</button>
            </div>
          );
        })}
        {entries.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            Поки немає записів. Додай першу перемогу, сильну сторону чи зону росту.
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold mb-4">Новий запис</h3>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(TYPE_META).map(([key, meta]) => (
                  <button type="button" key={key}
                    onClick={() => setForm(prev => ({ ...prev, type: key }))}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${form.type === key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    {meta.icon} {meta.label}
                  </button>
                ))}
              </div>
              <input className="input" placeholder="Заголовок *" value={form.title} onChange={set('title')} required />
              <textarea className="input" placeholder="Опис (що сталось, чому це важливо)" rows={3} value={form.description} onChange={set('description')} />
              <input className="input" type="date" value={form.entry_date} onChange={set('entry_date')} />
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Зберегти</button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setModal(false)}>Скасувати</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
