import React, { useEffect, useState } from 'react';
import api from '../hooks/useApi';
import toast from 'react-hot-toast';
import { format, isPast } from 'date-fns';

const EMPTY = { title: '', description: '', due_date: '', contact_id: '', deal_id: '' };

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    const completed = filter === 'done' ? 'true' : 'false';
    const [t, c, d] = await Promise.all([
      api.get(`/tasks?completed=${completed}`),
      api.get('/contacts'),
      api.get('/deals')
    ]);
    setTasks(t.data);
    setContacts(c.data);
    setDeals(d.data);
  };

  useEffect(() => { load(); }, [filter]);

  const save = async e => {
    e.preventDefault();
    await api.post('/tasks', form);
    toast.success('Task added');
    setModal(false);
    load();
  };

  const toggle = async task => {
    await api.put(`/tasks/${task.id}`, { ...task, completed: !task.completed });
    load();
  };

  const del = async id => {
    await api.delete(`/tasks/${id}`);
    load();
  };

  const set = f => e => setForm(prev => ({ ...prev, [f]: e.target.value }));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Tasks</h2>
        <button className="btn-primary" onClick={() => { setForm(EMPTY); setModal(true); }}>+ Add Task</button>
      </div>

      <div className="flex gap-2 mb-6">
        {['pending', 'done'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {f === 'pending' ? 'Pending' : 'Completed'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {tasks.map(t => {
          const overdue = !t.completed && t.due_date && isPast(new Date(t.due_date));
          return (
            <div key={t.id} className={`card flex items-center gap-4 py-4 ${overdue ? 'border-red-200' : ''}`}>
              <input type="checkbox" checked={t.completed} onChange={() => toggle(t)}
                className="w-5 h-5 rounded accent-blue-600" />
              <div className="flex-1">
                <div className={`font-medium ${t.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>{t.title}</div>
                <div className="text-sm text-slate-400 mt-0.5 flex gap-3">
                  {t.contact_name && <span>👤 {t.contact_name}</span>}
                  {t.deal_title && <span>💼 {t.deal_title}</span>}
                  {t.due_date && (
                    <span className={overdue ? 'text-red-500 font-medium' : ''}>
                      📅 {format(new Date(t.due_date), 'MMM d, yyyy')}
                      {overdue && ' (overdue)'}
                    </span>
                  )}
                </div>
              </div>
              <button className="text-red-400 hover:text-red-600 text-sm" onClick={() => del(t.id)}>Delete</button>
            </div>
          );
        })}
        {tasks.length === 0 && <div className="text-center py-12 text-slate-400">No tasks</div>}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold mb-4">New Task</h3>
            <form onSubmit={save} className="space-y-3">
              <input className="input" placeholder="Task title *" value={form.title} onChange={set('title')} required />
              <textarea className="input" placeholder="Description" rows={2} value={form.description} onChange={set('description')} />
              <input className="input" type="datetime-local" value={form.due_date} onChange={set('due_date')} />
              <select className="input" value={form.contact_id} onChange={set('contact_id')}>
                <option value="">Link to contact (optional)</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="input" value={form.deal_id} onChange={set('deal_id')}>
                <option value="">Link to deal (optional)</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Add Task</button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
