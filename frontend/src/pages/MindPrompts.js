import React, { useEffect, useState } from 'react';
import api from '../hooks/useApi';
import toast from 'react-hot-toast';

const CATEGORIES = ['all', 'focus', 'success', 'constructive', 'problem-solving', 'direction', 'energy', 'clarity', 'custom'];

const CATEGORY_LABELS = {
  all: 'All',
  focus: 'Focus',
  success: 'Success',
  constructive: 'Constructive',
  'problem-solving': 'Problem Solving',
  direction: 'Direction',
  energy: 'Energy',
  clarity: 'Clarity',
  custom: 'My Prompts',
};

const CATEGORY_COLORS = {
  focus: 'bg-blue-100 text-blue-700',
  success: 'bg-green-100 text-green-700',
  constructive: 'bg-purple-100 text-purple-700',
  'problem-solving': 'bg-orange-100 text-orange-700',
  direction: 'bg-teal-100 text-teal-700',
  energy: 'bg-rose-100 text-rose-700',
  clarity: 'bg-amber-100 text-amber-700',
  custom: 'bg-slate-100 text-slate-700',
};

export default function MindPrompts() {
  const [prompts, setPrompts] = useState([]);
  const [daily, setDaily] = useState(null);
  const [category, setCategory] = useState('all');
  const [modal, setModal] = useState(false);
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState('custom');
  const [reflected, setReflected] = useState(null);

  const load = async () => {
    const [p, d] = await Promise.all([
      api.get(`/mind-prompts${category !== 'all' ? `?category=${category}` : ''}`),
      api.get('/mind-prompts/daily'),
    ]);
    setPrompts(p.data);
    setDaily(d.data);
  };

  useEffect(() => { load(); }, [category]);

  const use = async (id) => {
    await api.put(`/mind-prompts/${id}/use`);
    setReflected(id);
    load();
    toast.success('Marked as reflected on');
  };

  const favorite = async (id) => {
    await api.put(`/mind-prompts/${id}/favorite`);
    load();
  };

  const del = async (id) => {
    await api.delete(`/mind-prompts/${id}`);
    load();
    toast.success('Prompt deleted');
  };

  const save = async e => {
    e.preventDefault();
    if (!newText.trim()) return;
    await api.post('/mind-prompts', { text: newText, category: newCategory });
    toast.success('Prompt added');
    setModal(false);
    setNewText('');
    setNewCategory('custom');
    load();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Mind Prompts</h2>
          <p className="text-slate-500 text-sm mt-1">Direct your mind with constructive questions</p>
        </div>
        <button className="btn-primary" onClick={() => setModal(true)}>+ Add Prompt</button>
      </div>

      {daily && (
        <div className="mb-8 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white shadow-lg">
          <div className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-3">Today's Prompt</div>
          <p className="text-xl font-medium leading-relaxed mb-5">"{daily.text}"</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => use(daily.id)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              Reflected on this
            </button>
            <span className={`text-xs px-2 py-1 rounded-full bg-white/15 capitalize`}>
              {CATEGORY_LABELS[daily.category] || daily.category}
            </span>
            {daily.times_used > 0 && (
              <span className="text-xs opacity-60">Used {daily.times_used}×</span>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              category === c
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {prompts.map(p => (
          <div
            key={p.id}
            className={`card flex gap-4 items-start py-4 transition-all ${
              reflected === p.id ? 'border-green-300 bg-green-50' : ''
            }`}
          >
            <button
              onClick={() => favorite(p.id)}
              className={`text-xl mt-0.5 flex-shrink-0 transition-transform hover:scale-110 ${
                p.is_favorite ? 'opacity-100' : 'opacity-30 hover:opacity-60'
              }`}
              title={p.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              ★
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-slate-800 font-medium leading-relaxed">"{p.text}"</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[p.category] || 'bg-slate-100 text-slate-600'}`}>
                  {CATEGORY_LABELS[p.category] || p.category}
                </span>
                {p.times_used > 0 && (
                  <span className="text-xs text-slate-400">Reflected {p.times_used}×</span>
                )}
                {p.is_builtin && (
                  <span className="text-xs text-slate-300">built-in</span>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => use(p.id)}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors font-medium"
              >
                Reflect
              </button>
              {!p.is_builtin && (
                <button
                  onClick={() => del(p.id)}
                  className="text-xs px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
        {prompts.length === 0 && (
          <div className="text-center py-12 text-slate-400">No prompts in this category</div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold mb-4">New Mind Prompt</h3>
            <form onSubmit={save} className="space-y-3">
              <textarea
                className="input"
                placeholder="Write a constructive question or affirmation..."
                rows={3}
                value={newText}
                onChange={e => setNewText(e.target.value)}
                required
                autoFocus
              />
              <select className="input" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                {CATEGORIES.filter(c => c !== 'all').map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Add Prompt</button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
