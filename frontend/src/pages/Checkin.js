import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const MOODS = [
  { value: 1, emoji: '😔', label: 'Погано' },
  { value: 2, emoji: '😕', label: 'Нижче норми' },
  { value: 3, emoji: '😐', label: 'Нормально' },
  { value: 4, emoji: '🙂', label: 'Добре' },
  { value: 5, emoji: '😄', label: 'Чудово' },
];

export default function Checkin() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const date = params.get('date');
  const type = params.get('type');
  const uid = params.get('uid');

  const [step, setStep] = useState('loading'); // loading | form | done | error
  const [existing, setExisting] = useState(null);
  const [form, setForm] = useState({ goals: '', achievements: '', obstacles: '', tomorrow_priorities: '', mood: 0 });
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isMorning = type === 'morning';

  useEffect(() => {
    if (!token || !date || !type || !uid) { setStep('error'); return; }
    axios.get(`${API}/checkin/verify`, { params: { token, date, type, uid } })
      .then(r => {
        if (r.data.existing) {
          setExisting(r.data.existing);
          setForm({
            goals: r.data.existing.goals || '',
            achievements: r.data.existing.achievements || '',
            obstacles: r.data.existing.obstacles || '',
            tomorrow_priorities: r.data.existing.tomorrow_priorities || '',
            mood: r.data.existing.mood || 0,
          });
          setResult({ ai_analysis: r.data.existing.ai_analysis });
          setStep('done');
        } else {
          setStep('form');
        }
      })
      .catch(() => setStep('error'));
  }, [token, date, type, uid]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.mood) return alert('Оціни свій настрій');
    setSubmitting(true);
    try {
      const r = await axios.post(`${API}/checkin/submit`, { token, date, type, uid, ...form });
      setResult(r.data);
      setStep('done');
    } catch {
      alert('Помилка збереження. Спробуй ще раз.');
    } finally {
      setSubmitting(false);
    }
  };

  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

  const dateFormatted = date
    ? format(new Date(date), 'EEEE, d MMMM yyyy', { locale: uk })
    : '';

  if (step === 'loading') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-slate-400 text-lg">Завантаження...</div>
    </div>
  );

  if (step === 'error') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow p-8 max-w-md text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-slate-700 mb-2">Посилання недійсне</h2>
        <p className="text-slate-400">Посилання застаріло або невірне. Отримай нове нагадування.</p>
      </div>
    </div>
  );

  const bg = isMorning
    ? 'from-orange-50 to-amber-50'
    : 'from-violet-50 to-purple-50';
  const accent = isMorning ? '#2563eb' : '#7c3aed';
  const accentLight = isMorning ? 'bg-blue-600' : 'bg-violet-600';

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bg} p-4 flex items-start justify-center pt-10`}>
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">{isMorning ? '🌅' : '🌙'}</div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isMorning ? 'Ранкове планування' : 'Вечірній check-in'}
          </h1>
          <p className="text-slate-500 mt-1 capitalize">{dateFormatted}</p>
        </div>

        {step === 'form' && (
          <form onSubmit={submit} className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
              {isMorning ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      🎯 Мої головні цілі на сьогодні
                    </label>
                    <textarea className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                      rows={3} placeholder="Що найважливіше зробити сьогодні?"
                      value={form.goals} onChange={set('goals')} required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      📋 Пріоритети на сьогодні (топ-3)
                    </label>
                    <textarea className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                      rows={3} placeholder="1. &#10;2. &#10;3. "
                      value={form.tomorrow_priorities} onChange={set('tomorrow_priorities')} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      ✅ Що вдалося виконати сьогодні?
                    </label>
                    <textarea className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-300"
                      rows={3} placeholder="Які цілі досягнуто?"
                      value={form.achievements} onChange={set('achievements')} required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      🚧 Що завадило або не вийшло?
                    </label>
                    <textarea className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-300"
                      rows={2} placeholder="Перешкоди, відволікання, причини..."
                      value={form.obstacles} onChange={set('obstacles')} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      🎯 Топ-3 пріоритети на завтра
                    </label>
                    <textarea className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-300"
                      rows={3} placeholder="1. &#10;2. &#10;3. "
                      value={form.tomorrow_priorities} onChange={set('tomorrow_priorities')} />
                  </div>
                </>
              )}

              {/* Mood */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  💭 Твій настрій зараз
                </label>
                <div className="flex gap-2 justify-between">
                  {MOODS.map(m => (
                    <button key={m.value} type="button"
                      onClick={() => setForm(p => ({ ...p, mood: m.value }))}
                      className={`flex-1 flex flex-col items-center py-2 px-1 rounded-xl border-2 transition-all ${
                        form.mood === m.value
                          ? isMorning ? 'border-blue-500 bg-blue-50' : 'border-violet-500 bg-violet-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}>
                      <span className="text-xl">{m.emoji}</span>
                      <span className="text-xs text-slate-500 mt-1 hidden sm:block">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button type="submit" disabled={submitting}
              className={`w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg transition-all disabled:opacity-60 ${accentLight}`}>
              {submitting ? 'Зберігаю...' : isMorning ? '🚀 Починаємо день!' : '✨ Завершити день'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-xl">✓</div>
                <div>
                  <div className="font-bold text-slate-800">
                    {existing ? 'Вже заповнено раніше' : 'Збережено!'}
                  </div>
                  <div className="text-sm text-slate-400">
                    {isMorning ? 'Ранковий check-in' : 'Вечірній check-in'} · {dateFormatted}
                  </div>
                </div>
              </div>

              {/* Summary */}
              {isMorning && form.goals && (
                <div className="bg-blue-50 rounded-xl p-4 mb-3">
                  <div className="text-xs font-semibold text-blue-600 mb-1">Твої цілі на сьогодні</div>
                  <div className="text-sm text-slate-700 whitespace-pre-line">{form.goals}</div>
                </div>
              )}
              {!isMorning && form.achievements && (
                <div className="bg-green-50 rounded-xl p-4 mb-3">
                  <div className="text-xs font-semibold text-green-600 mb-1">Досягнення дня</div>
                  <div className="text-sm text-slate-700 whitespace-pre-line">{form.achievements}</div>
                </div>
              )}
            </div>

            {/* AI Analysis */}
            {result?.ai_analysis && (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">🤖</span>
                  <span className="font-semibold text-slate-700">AI-аналіз та порівняння</span>
                </div>
                <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {result.ai_analysis}
                </div>
              </div>
            )}

            <div className="text-center text-slate-400 text-sm pb-8">
              До зустрічі {isMorning ? 'ввечері' : 'завтра вранці'}! 👋
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
