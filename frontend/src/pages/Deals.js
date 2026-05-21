import React, { useEffect, useState } from 'react';
import api from '../hooks/useApi';
import toast from 'react-hot-toast';

const STAGES = ['prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
const STAGE_COLORS = {
  prospect: 'bg-slate-100 text-slate-600',
  qualified: 'bg-blue-100 text-blue-700',
  proposal: 'bg-purple-100 text-purple-700',
  negotiation: 'bg-orange-100 text-orange-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
};

const EMPTY = { title: '', value: '', stage: 'prospect', probability: 0, expected_close: '', notes: '', contact_id: '' };

export default function Deals() {
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [view, setView] = useState('list');

  const load = async () => {
    const [d, c] = await Promise.all([api.get('/deals'), api.get('/contacts')]);
    setDeals(d.data);
    setContacts(c.data);
  };

  useEffect(() => { load(); }, []);

  const save = async e => {
    e.preventDefault();
    try {
      if (modal === 'new') await api.post('/deals', form);
      else await api.put(`/deals/${form.id}`, form);
      toast.success('Deal saved');
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const del = async id => {
    if (!window.confirm('Delete deal?')) return;
    await api.delete(`/deals/${id}`);
    load();
  };

  const set = f => e => setForm(prev => ({ ...prev, [f]: e.target.value }));
  const totalValue = deals.reduce((s, d) => s + Number(d.value || 0), 0);
  const wonValue = deals.filter(d => d.stage === 'won').reduce((s, d) => s + Number(d.value || 0), 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Deals</h2>
          <p className="text-slate-500 text-sm mt-1">
            Pipeline: <strong>${totalValue.toLocaleString()}</strong> · Won: <strong className="text-green-600">${wonValue.toLocaleString()}</strong>
          </p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(EMPTY); setModal('new'); }}>+ Add Deal</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Deal', 'Contact', 'Value', 'Stage', 'Close Date', 'Actions'].map(h => (
                <th key={h} className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {deals.map(d => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-800">{d.title}</td>
                <td className="px-6 py-4 text-slate-500">{d.contact_name || '—'}</td>
                <td className="px-6 py-4 font-medium">${Number(d.value).toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className={`badge ${STAGE_COLORS[d.stage]}`}>{d.stage}</span>
                </td>
                <td className="px-6 py-4 text-slate-500">{d.expected_close ? new Date(d.expected_close).toLocaleDateString() : '—'}</td>
                <td className="px-6 py-4">
                  <button className="text-blue-600 hover:underline text-sm mr-3" onClick={() => { setForm(d); setModal('edit'); }}>Edit</button>
                  <button className="text-red-400 hover:underline text-sm" onClick={() => del(d.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {deals.length === 0 && <div className="text-center py-12 text-slate-400">No deals yet</div>}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold mb-4">{modal === 'new' ? 'New Deal' : 'Edit Deal'}</h3>
            <form onSubmit={save} className="space-y-3">
              <input className="input" placeholder="Deal Title *" value={form.title} onChange={set('title')} required />
              <select className="input" value={form.contact_id || ''} onChange={set('contact_id')}>
                <option value="">Select Contact</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input className="input" placeholder="Value ($)" type="number" value={form.value} onChange={set('value')} />
              <select className="input" value={form.stage} onChange={set('stage')}>
                {STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              <input className="input" type="date" value={form.expected_close?.split('T')[0] || ''} onChange={set('expected_close')} />
              <textarea className="input" placeholder="Notes" rows={3} value={form.notes || ''} onChange={set('notes')} />
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
