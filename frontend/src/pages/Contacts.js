import React, { useEffect, useState } from 'react';
import api from '../hooks/useApi';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  lead: 'bg-yellow-100 text-yellow-700',
  prospect: 'bg-blue-100 text-blue-700',
  customer: 'bg-green-100 text-green-700',
  churned: 'bg-red-100 text-red-700',
};

const EMPTY = { name: '', email: '', phone: '', company: '', status: 'lead', notes: '' };

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [aiLoading, setAiLoading] = useState(false);

  const load = async () => {
    const { data } = await api.get(`/contacts?search=${search}`);
    setContacts(data);
  };

  useEffect(() => { load(); }, [search]);

  const openNew = () => { setForm(EMPTY); setModal('new'); };
  const openEdit = c => { setForm(c); setModal('edit'); };

  const save = async e => {
    e.preventDefault();
    try {
      if (modal === 'new') {
        await api.post('/contacts', form);
        toast.success('Contact added');
      } else {
        await api.put(`/contacts/${form.id}`, form);
        toast.success('Contact updated');
      }
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error saving');
    }
  };

  const del = async id => {
    if (!window.confirm('Delete this contact?')) return;
    await api.delete(`/contacts/${id}`);
    toast.success('Deleted');
    load();
  };

  const aiSummarize = async id => {
    setAiLoading(id);
    try {
      const { data } = await api.post(`/ai/summarize-contact/${id}`);
      toast.success('AI summary generated!');
      setForm(f => ({ ...f, ai_summary: data.summary }));
      load();
    } catch {
      toast.error('AI unavailable');
    } finally {
      setAiLoading(false);
    }
  };

  const set = f => e => setForm(prev => ({ ...prev, [f]: e.target.value }));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Contacts</h2>
        <button className="btn-primary" onClick={openNew}>+ Add Contact</button>
      </div>

      <div className="mb-4">
        <input className="input max-w-sm" placeholder="Search contacts..." value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Name', 'Company', 'Email', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {contacts.map(c => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-800">{c.name}</td>
                <td className="px-6 py-4 text-slate-500">{c.company || '—'}</td>
                <td className="px-6 py-4 text-slate-500">{c.email || '—'}</td>
                <td className="px-6 py-4">
                  <span className={`badge ${STATUS_COLORS[c.status] || ''}`}>{c.status}</span>
                </td>
                <td className="px-6 py-4">
                  <button className="text-blue-600 hover:underline text-sm mr-3" onClick={() => openEdit(c)}>Edit</button>
                  <button className="text-red-400 hover:underline text-sm" onClick={() => del(c.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {contacts.length === 0 && <div className="text-center py-12 text-slate-400">No contacts yet</div>}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold mb-4">{modal === 'new' ? 'Add Contact' : 'Edit Contact'}</h3>
            <form onSubmit={save} className="space-y-3">
              <input className="input" placeholder="Full Name *" value={form.name} onChange={set('name')} required />
              <input className="input" placeholder="Email" type="email" value={form.email || ''} onChange={set('email')} />
              <input className="input" placeholder="Phone" value={form.phone || ''} onChange={set('phone')} />
              <input className="input" placeholder="Company" value={form.company || ''} onChange={set('company')} />
              <select className="input" value={form.status} onChange={set('status')}>
                <option value="lead">Lead</option>
                <option value="prospect">Prospect</option>
                <option value="customer">Customer</option>
                <option value="churned">Churned</option>
              </select>
              <textarea className="input" placeholder="Notes" rows={3} value={form.notes || ''} onChange={set('notes')} />
              {form.ai_summary && (
                <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                  <strong>AI Summary:</strong> {form.ai_summary}
                </div>
              )}
              {modal === 'edit' && (
                <button type="button" className="btn-secondary w-full"
                  onClick={() => aiSummarize(form.id)} disabled={!!aiLoading}>
                  {aiLoading === form.id ? 'Generating...' : '🤖 Generate AI Summary'}
                </button>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Save</button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
