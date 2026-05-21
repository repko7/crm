import React, { useState } from 'react';
import api from '../hooks/useApi';
import toast from 'react-hot-toast';

export default function AIAssistant() {
  const [tab, setTab] = useState('coach');
  const [question, setQuestion] = useState('');
  const [emailContext, setEmailContext] = useState('');
  const [contactId, setContactId] = useState('');
  const [contacts, setContacts] = useState([]);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    api.get('/contacts').then(r => setContacts(r.data));
  }, []);

  const runCoach = async () => {
    setLoading(true);
    setResult('');
    try {
      const { data } = await api.post('/ai/coach', { question });
      setResult(data.advice);
    } catch { toast.error('AI unavailable — check your OpenAI API key'); }
    finally { setLoading(false); }
  };

  const runEmail = async () => {
    if (!contactId) return toast.error('Select a contact first');
    setLoading(true);
    setResult('');
    try {
      const { data } = await api.post('/ai/draft-email', { contact_id: contactId, context: emailContext });
      setResult(data.email);
    } catch { toast.error('AI unavailable — check your OpenAI API key'); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">AI Assistant</h2>
      <p className="text-slate-500 mb-6">Your personal AI sales coach. Powered by GPT-4.</p>

      <div className="flex gap-2 mb-6">
        {['coach', 'email'].map(t => (
          <button key={t} onClick={() => { setTab(t); setResult(''); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
            {t === 'coach' ? '🎯 Sales Coach' : '✉️ Email Drafter'}
          </button>
        ))}
      </div>

      {tab === 'coach' && (
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-3">Ask your sales coach anything</h3>
          <textarea className="input mb-3" rows={4} placeholder="e.g. What should I focus on today? How do I close a deal that's been stuck for 2 weeks?"
            value={question} onChange={e => setQuestion(e.target.value)} />
          <button className="btn-primary" onClick={runCoach} disabled={loading}>
            {loading ? 'Thinking...' : 'Get Advice'}
          </button>
        </div>
      )}

      {tab === 'email' && (
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-3">Draft a follow-up email</h3>
          <select className="input mb-3" value={contactId} onChange={e => setContactId(e.target.value)}>
            <option value="">Select contact...</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>)}
          </select>
          <textarea className="input mb-3" rows={3} placeholder="Context: e.g. We met at a conference, they were interested in our pricing..."
            value={emailContext} onChange={e => setEmailContext(e.target.value)} />
          <button className="btn-primary" onClick={runEmail} disabled={loading}>
            {loading ? 'Writing...' : 'Draft Email'}
          </button>
        </div>
      )}

      {result && (
        <div className="card mt-6 bg-blue-50 border-blue-100">
          <div className="flex justify-between items-start mb-3">
            <h4 className="font-semibold text-blue-800">AI Response</h4>
            <button onClick={() => { navigator.clipboard.writeText(result); toast.success('Copied!'); }}
              className="text-blue-600 text-sm hover:underline">Copy</button>
          </div>
          <div className="text-slate-700 whitespace-pre-line leading-relaxed">{result}</div>
        </div>
      )}

      <div className="mt-8 card bg-amber-50 border-amber-100">
        <h4 className="font-medium text-amber-800 mb-2">Setup Required</h4>
        <p className="text-sm text-amber-700">
          Add your <code className="bg-amber-100 px-1 rounded">OPENAI_API_KEY</code> to <code className="bg-amber-100 px-1 rounded">backend/.env</code> to enable AI features.
          Get your key at platform.openai.com
        </p>
      </div>
    </div>
  );
}
