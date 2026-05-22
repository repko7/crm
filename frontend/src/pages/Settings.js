import React, { useEffect, useState } from 'react';
import api from '../hooks/useApi';
import toast from 'react-hot-toast';

export default function Settings() {
  const [tab, setTab] = useState('team');
  const [team, setTeam] = useState(null);
  const [apiKeys, setApiKeys] = useState([]);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', password: '' });
  const [newKeyName, setNewKeyName] = useState('');
  const [freshKey, setFreshKey] = useState(null);

  const loadTeam = () => api.get('/team').then(r => setTeam(r.data)).catch(() => {});
  const loadKeys = () => api.get('/keys').then(r => setApiKeys(r.data)).catch(() => {});

  useEffect(() => {
    loadTeam();
    loadKeys();
  }, []);

  const invite = async e => {
    e.preventDefault();
    try {
      await api.post('/team/invite', inviteForm);
      toast.success('Team member added!');
      setInviteForm({ name: '', email: '', password: '' });
      loadTeam();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error inviting member');
    }
  };

  const removeMember = async id => {
    if (!window.confirm('Remove this team member?')) return;
    await api.delete(`/team/members/${id}`);
    toast.success('Member removed');
    loadTeam();
  };

  const createKey = async e => {
    e.preventDefault();
    try {
      const { data } = await api.post('/keys', { name: newKeyName });
      setFreshKey(data.key);
      setNewKeyName('');
      loadKeys();
      toast.success('API key created');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const revokeKey = async id => {
    if (!window.confirm('Revoke this API key? This cannot be undone.')) return;
    await api.delete(`/keys/${id}`);
    toast.success('Key revoked');
    loadKeys();
  };

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const set = f => e => setInviteForm(prev => ({ ...prev, [f]: e.target.value }));

  return (
    <div className="p-8 max-w-4xl">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Settings</h2>

      <div className="flex gap-2 mb-6">
        {['team', 'api'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {t === 'team' ? '👥 Team Members' : '🔑 API Keys'}
          </button>
        ))}
      </div>

      {tab === 'team' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-4">Your Team</h3>
            {team?.members?.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {team.members.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium text-slate-800">{m.name}</div>
                      <div className="text-sm text-slate-400">{m.email}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`badge ${m.id === team.owner_id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                        {m.id === team.owner_id ? 'Owner' : 'Member'}
                      </span>
                      {m.id !== team.owner_id && m.id !== Number(user.id) && (
                        <button onClick={() => removeMember(m.id)} className="text-red-400 text-sm hover:underline">Remove</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No team members yet.</p>
            )}
          </div>

          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-4">Invite Team Member</h3>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4 text-sm text-amber-700">
              Requires <strong>Team plan</strong>. Up to 10 members total.
            </div>
            <form onSubmit={invite} className="space-y-3">
              <input className="input" placeholder="Full Name" value={inviteForm.name} onChange={set('name')} required />
              <input className="input" type="email" placeholder="Email" value={inviteForm.email} onChange={set('email')} required />
              <input className="input" type="password" placeholder="Temporary password" value={inviteForm.password} onChange={set('password')} required minLength={6} />
              <button type="submit" className="btn-primary">Send Invite</button>
            </form>
          </div>
        </div>
      )}

      {tab === 'api' && (
        <div className="space-y-6">
          {freshKey && (
            <div className="card bg-green-50 border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">New API Key Created</h4>
              <p className="text-sm text-green-700 mb-3">Save this key now — it won't be shown again.</p>
              <div className="bg-white border border-green-200 rounded-lg px-4 py-3 font-mono text-sm text-slate-800 flex items-center justify-between gap-4">
                <span className="truncate">{freshKey}</span>
                <button onClick={() => { navigator.clipboard.writeText(freshKey); toast.success('Copied!'); }}
                  className="btn-secondary text-xs shrink-0">Copy</button>
              </div>
              <button onClick={() => setFreshKey(null)} className="text-green-600 text-sm mt-3 hover:underline">Dismiss</button>
            </div>
          )}

          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-4">Create API Key</h3>
            <form onSubmit={createKey} className="flex gap-3">
              <input className="input flex-1" placeholder="Key name (e.g. Zapier integration)"
                value={newKeyName} onChange={e => setNewKeyName(e.target.value)} required />
              <button type="submit" className="btn-primary shrink-0">Create Key</button>
            </form>
          </div>

          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-4">Active API Keys</h3>
            {apiKeys.length === 0 ? (
              <p className="text-slate-400 text-sm">No API keys yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {apiKeys.map(k => (
                  <div key={k.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium text-slate-800">{k.name}</div>
                      <div className="text-xs text-slate-400">
                        Created {new Date(k.created_at).toLocaleDateString()}
                        {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                      </div>
                    </div>
                    <button onClick={() => revokeKey(k.id)} className="text-red-400 text-sm hover:underline">Revoke</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card bg-slate-50">
            <h4 className="font-semibold text-slate-700 mb-3">Quick Start</h4>
            <pre className="bg-slate-800 text-green-400 rounded-lg p-4 text-xs overflow-x-auto">{`# Get contacts
curl https://api.yourcrm.com/api/v1/contacts \\
  -H "X-Api-Key: crm_your_key_here"

# Create a contact
curl -X POST https://api.yourcrm.com/api/v1/contacts \\
  -H "X-Api-Key: crm_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "John Smith", "email": "john@example.com"}'`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
