import React, { useEffect, useState, useCallback } from 'react';
import api from '../hooks/useApi';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { uk } from 'date-fns/locale';

const CATEGORIES = [
  { value: 'personal', label: 'Особисте', color: 'bg-purple-100 text-purple-700' },
  { value: 'business', label: 'Бізнес', color: 'bg-blue-100 text-blue-700' },
  { value: 'health', label: 'Здоров\'я', color: 'bg-green-100 text-green-700' },
  { value: 'financial', label: 'Фінанси', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'relationships', label: 'Стосунки', color: 'bg-pink-100 text-pink-700' },
];

const EMPTY_GOAL = {
  title: '', measurable: '', action_plan: '', relevance: '', deadline: '',
  category: 'personal', session_type: 'morning',
};

const EMPTY_SETTINGS = {
  goal_reminder_enabled: false, goal_reminder_morning: 7,
  goal_reminder_evening: 21, goal_reminder_timezone: 'Europe/Kiev',
};

const categoryStyle = (cat) =>
  CATEGORIES.find(c => c.value === cat)?.color || 'bg-slate-100 text-slate-600';

const categoryLabel = (cat) =>
  CATEGORIES.find(c => c.value === cat)?.label || cat;

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [tab, setTab] = useState('today');
  const [sessionFilter, setSessionFilter] = useState('morning');
  const [modal, setModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [coaching, setCoaching] = useState(null);
  const [coachingGoalId, setCoachingGoalId] = useState(null);
  const [form, setForm] = useState(EMPTY_GOAL);
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [editGoal, setEditGoal] = useState(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const morningHour = new Date().getHours() < 12;
  const currentSessionType = morningHour ? 'morning' : 'evening';

  const loadGoals = useCallback(async () => {
    const params = tab === 'today' ? `?date=${todayStr}` : tab === 'active' ? '?status=active' : '';
    const res = await api.get(`/goals${params}`);
    setGoals(res.data);
  }, [tab, todayStr]);

  const loadSettings = async () => {
    const res = await api.get('/goals/settings');
    setSettings({ ...EMPTY_SETTINGS, ...res.data });
  };

  useEffect(() => { loadGoals(); }, [loadGoals]);
  useEffect(() => { loadSettings(); }, []);

  const openNew = () => {
    setForm({ ...EMPTY_GOAL, session_type: currentSessionType });
    setEditGoal(null);
    setModal(true);
  };

  const openEdit = (goal) => {
    setForm({
      title: goal.title || '',
      measurable: goal.measurable || '',
      action_plan: goal.action_plan || '',
      relevance: goal.relevance || '',
      deadline: goal.deadline ? goal.deadline.split('T')[0] : '',
      category: goal.category || 'personal',
      session_type: goal.session_type || 'morning',
    });
    setEditGoal(goal);
    setModal(true);
  };

  const saveGoal = async (e) => {
    e.preventDefault();
    try {
      if (editGoal) {
        await api.put(`/goals/${editGoal.id}`, form);
        toast.success('Ціль оновлено');
      } else {
        await api.post('/goals', form);
        toast.success('Ціль додано!');
      }
      setModal(false);
      loadGoals();
    } catch {
      toast.error('Помилка збереження');
    }
  };

  const deleteGoal = async (id) => {
    await api.delete(`/goals/${id}`);
    toast.success('Ціль видалено');
    loadGoals();
  };

  const completeGoal = async (goal) => {
    const newStatus = goal.status === 'completed' ? 'active' : 'completed';
    await api.put(`/goals/${goal.id}`, { status: newStatus });
    loadGoals();
  };

  const getCoaching = async (goal) => {
    setLoadingCoach(true);
    setCoachingGoalId(goal.id);
    setCoaching(null);
    try {
      const res = await api.post(`/goals/${goal.id}/coach`);
      setCoaching(res.data.feedback);
      loadGoals();
    } catch {
      toast.error('Помилка AI коучингу');
    } finally {
      setLoadingCoach(false);
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    await api.put('/goals/settings', settings);
    toast.success('Налаштування збережено');
    setSettingsModal(false);
  };

  const filteredGoals = tab === 'today'
    ? goals.filter(g => g.session_type === sessionFilter)
    : goals;

  const completedCount = goals.filter(g => g.status === 'completed').length;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {morningHour ? '🌅 Ранкове планування' : '🌙 Вечірнє планування'}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {format(new Date(), 'EEEE, d MMMM yyyy', { locale: uk })}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSettingsModal(true)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm">
            ⚙️ Нагадування
          </button>
          <button onClick={openNew} className="btn-primary">+ Нова ціль</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 mt-4">
        {[
          { key: 'today', label: 'Сьогодні' },
          { key: 'active', label: 'Всі активні' },
          { key: 'all', label: 'Архів' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Morning/Evening toggle (today tab only) */}
      {tab === 'today' && (
        <div className="flex gap-2 mb-4">
          <button onClick={() => setSessionFilter('morning')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              sessionFilter === 'morning' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}>
            🌅 Ранок
          </button>
          <button onClick={() => setSessionFilter('evening')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              sessionFilter === 'evening' ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}>
            🌙 Вечір
          </button>
        </div>
      )}

      {/* Stats bar */}
      {tab === 'today' && goals.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 flex gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-700">{goals.length}</div>
            <div className="text-xs text-blue-500">цілей сьогодні</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
            <div className="text-xs text-green-500">виконано</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-600">
              {goals.length > 0 ? Math.round((completedCount / goals.length) * 100) : 0}%
            </div>
            <div className="text-xs text-slate-400">прогрес</div>
          </div>
        </div>
      )}

      {/* Goals list */}
      <div className="space-y-3">
        {filteredGoals.map(goal => (
          <div key={goal.id}
            className={`card p-5 transition-all ${goal.status === 'completed' ? 'opacity-70' : ''}`}>
            <div className="flex items-start gap-3">
              <button onClick={() => completeGoal(goal)}
                className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  goal.status === 'completed'
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-slate-300 hover:border-green-400'
                }`}>
                {goal.status === 'completed' && '✓'}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className={`font-semibold text-slate-800 ${goal.status === 'completed' ? 'line-through text-slate-400' : ''}`}>
                    {goal.title}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryStyle(goal.category)}`}>
                    {categoryLabel(goal.category)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    goal.session_type === 'morning' ? 'bg-orange-50 text-orange-600' : 'bg-violet-50 text-violet-600'
                  }`}>
                    {goal.session_type === 'morning' ? '🌅 Ранок' : '🌙 Вечір'}
                  </span>
                </div>

                {/* SMART details */}
                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  {goal.measurable && (
                    <div><span className="font-medium text-blue-600">M:</span> {goal.measurable}</div>
                  )}
                  {goal.action_plan && (
                    <div><span className="font-medium text-green-600">A:</span> {goal.action_plan}</div>
                  )}
                  {goal.relevance && (
                    <div><span className="font-medium text-purple-600">R:</span> {goal.relevance}</div>
                  )}
                  {goal.deadline && (
                    <div><span className="font-medium text-red-500">T:</span> до {format(parseISO(goal.deadline), 'd MMMM yyyy', { locale: uk })}</div>
                  )}
                </div>

                {/* AI Feedback */}
                {coachingGoalId === goal.id && coaching && (
                  <div className="mt-3 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 rounded-lg p-4">
                    <div className="text-xs font-semibold text-blue-600 mb-2">🤖 AI SMART-коуч</div>
                    <div className="text-sm text-slate-700 whitespace-pre-line">{coaching}</div>
                  </div>
                )}
                {goal.ai_feedback && coachingGoalId !== goal.id && (
                  <button onClick={() => { setCoachingGoalId(goal.id); setCoaching(goal.ai_feedback); }}
                    className="mt-2 text-xs text-blue-500 hover:text-blue-700">
                    Показати AI-аналіз →
                  </button>
                )}
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => getCoaching(goal)}
                  disabled={loadingCoach && coachingGoalId === goal.id}
                  className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium disabled:opacity-50">
                  {loadingCoach && coachingGoalId === goal.id ? '...' : '🤖 AI'}
                </button>
                <button onClick={() => openEdit(goal)}
                  className="text-xs px-3 py-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg">
                  Змінити
                </button>
                <button onClick={() => deleteGoal(goal.id)}
                  className="text-xs px-3 py-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredGoals.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">{sessionFilter === 'morning' ? '🌅' : '🌙'}</div>
            <div className="text-slate-400 text-lg font-medium mb-2">
              {tab === 'today'
                ? `Ще немає ${sessionFilter === 'morning' ? 'ранкових' : 'вечірніх'} цілей`
                : 'Цілей не знайдено'}
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Постав чіткі SMART-цілі, щоб рухатися до успіху
            </p>
            <button onClick={openNew} className="btn-primary">+ Додати першу ціль</button>
          </div>
        )}
      </div>

      {/* New/Edit Goal Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                {editGoal ? 'Редагувати ціль' : 'Нова SMART-ціль'}
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Specific · Measurable · Achievable · Relevant · Time-bound
              </p>
            </div>
            <form onSubmit={saveGoal} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-blue-600 mb-1">
                  S — Ціль (конкретно що хочу досягти?) *
                </label>
                <input className="input" placeholder="Напр.: Підписати 3 нових контракти цього місяця"
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-green-600 mb-1">
                  M — Як виміряю результат?
                </label>
                <input className="input" placeholder="Напр.: 3 підписані договори, $15,000 нових продажів"
                  value={form.measurable} onChange={e => setForm(f => ({ ...f, measurable: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-orange-600 mb-1">
                  A — Які конкретні дії зроблю?
                </label>
                <textarea className="input" rows={2}
                  placeholder="Напр.: Провести 10 дзвінків, надіслати 20 листів, зустрітися з 5 клієнтами"
                  value={form.action_plan} onChange={e => setForm(f => ({ ...f, action_plan: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-purple-600 mb-1">
                  R — Чому ця ціль важлива для мене?
                </label>
                <input className="input" placeholder="Напр.: Досягну плану продажів і отримаю бонус"
                  value={form.relevance} onChange={e => setForm(f => ({ ...f, relevance: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-red-500 mb-1">T — Дедлайн</label>
                  <input className="input" type="date"
                    value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Категорія</label>
                  <select className="input" value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Сесія</label>
                <div className="flex gap-2">
                  {['morning', 'evening'].map(s => (
                    <button key={s} type="button"
                      onClick={() => setForm(f => ({ ...f, session_type: s }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        form.session_type === s
                          ? s === 'morning' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-violet-100 text-violet-700 border-violet-200'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}>
                      {s === 'morning' ? '🌅 Ранок' : '🌙 Вечір'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {editGoal ? 'Зберегти зміни' : 'Додати ціль'}
                </button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setModal(false)}>
                  Скасувати
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Налаштування нагадувань</h3>
            </div>
            <form onSubmit={saveSettings} className="p-6 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only"
                    checked={settings.goal_reminder_enabled}
                    onChange={e => setSettings(s => ({ ...s, goal_reminder_enabled: e.target.checked }))} />
                  <div className={`w-11 h-6 rounded-full transition-colors ${settings.goal_reminder_enabled ? 'bg-blue-600' : 'bg-slate-300'}`} />
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.goal_reminder_enabled ? 'translate-x-5' : ''}`} />
                </div>
                <span className="font-medium text-slate-700">Вмикнути email-нагадування</span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">🌅 Ранок (година)</label>
                  <input type="number" min="0" max="23" className="input"
                    value={settings.goal_reminder_morning}
                    onChange={e => setSettings(s => ({ ...s, goal_reminder_morning: parseInt(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">🌙 Вечір (година)</label>
                  <input type="number" min="0" max="23" className="input"
                    value={settings.goal_reminder_evening}
                    onChange={e => setSettings(s => ({ ...s, goal_reminder_evening: parseInt(e.target.value) }))} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Часовий пояс</label>
                <select className="input" value={settings.goal_reminder_timezone}
                  onChange={e => setSettings(s => ({ ...s, goal_reminder_timezone: e.target.value }))}>
                  <option value="Europe/Kiev">Київ (UTC+3)</option>
                  <option value="Europe/Warsaw">Варшава (UTC+2)</option>
                  <option value="Europe/London">Лондон (UTC+1)</option>
                  <option value="America/New_York">Нью-Йорк (UTC-5)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
                Ви будете отримувати email-нагадування щодня о {settings.goal_reminder_morning}:00 (ранок)
                та {settings.goal_reminder_evening}:00 (вечір) за Київським часом.
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Зберегти</button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setSettingsModal(false)}>
                  Скасувати
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
