import React, { useEffect, useState } from 'react';
import api from '../hooks/useApi';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function Emails() {
  const [status, setStatus] = useState({ gmail: false });
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/email/status').then(r => setStatus(r.data)).catch(() => {});
    api.get('/contacts').then(r => setContacts(r.data)).catch(() => {});

    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'gmail') toast.success('Gmail connected!');
    if (params.get('error')) toast.error('Gmail connection failed. Try again.');
  }, []);

  const connectGmail = async () => {
    try {
      const { data } = await api.get('/email/gmail/auth-url');
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gmail not configured yet');
    }
  };

  const disconnectGmail = async () => {
    await api.delete('/email/gmail');
    setStatus({ gmail: false });
    toast.success('Gmail disconnected');
  };

  const loadEmails = async contact => {
    setSelectedContact(contact);
    setLoading(true);
    try {
      const { data } = await api.get(`/email/contact/${contact.id}`);
      setEmails(data.emails || []);
      if (!data.connected) toast('Connect Gmail to see emails', { icon: '📧' });
    } catch {
      toast.error('Failed to load emails');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Email</h2>
        <div className="flex items-center gap-3">
          {status.gmail ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                Gmail connected
              </span>
              <button className="btn-secondary text-sm" onClick={disconnectGmail}>Disconnect</button>
            </div>
          ) : (
            <button className="btn-primary flex items-center gap-2" onClick={connectGmail}>
              <span>📧</span> Connect Gmail
            </button>
          )}
        </div>
      </div>

      {!status.gmail && (
        <div className="card bg-blue-50 border-blue-100 mb-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">📧</div>
            <div>
              <h3 className="font-semibold text-blue-800 mb-1">Connect your inbox</h3>
              <p className="text-blue-600 text-sm">
                Link your Gmail account to see every email conversation with a contact in one place.
                Your emails stay private — we only read, never send.
              </p>
              <button className="btn-primary mt-3 text-sm" onClick={connectGmail}>Connect Gmail</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Contact list */}
        <div className="w-72 shrink-0">
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase">
              Select a contact
            </div>
            <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
              {contacts.map(c => (
                <button key={c.id} onClick={() => loadEmails(c)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${selectedContact?.id === c.id ? 'bg-blue-50' : ''}`}>
                  <div className="font-medium text-slate-800 text-sm">{c.name}</div>
                  <div className="text-slate-400 text-xs">{c.email || c.company || '—'}</div>
                </button>
              ))}
              {contacts.length === 0 && (
                <div className="px-4 py-8 text-center text-slate-400 text-sm">No contacts yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Email list */}
        <div className="flex-1">
          {!selectedContact ? (
            <div className="card flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-3">📬</div>
              <p className="text-slate-400">Select a contact to view their email history</p>
            </div>
          ) : loading ? (
            <div className="card py-20 text-center text-slate-400">Loading emails...</div>
          ) : emails.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-20">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-slate-500 font-medium">{selectedContact.name}</p>
              <p className="text-slate-400 text-sm mt-1">
                {status.gmail ? 'No emails found with this contact' : 'Connect Gmail to see emails'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-slate-500 mb-2">
                {emails.length} emails with <strong>{selectedContact.name}</strong>
              </div>
              {emails.map(email => (
                <div key={email.id} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 text-sm mb-0.5 truncate">
                        {email.subject || '(no subject)'}
                      </div>
                      <div className="text-xs text-slate-400 mb-2">{email.from}</div>
                      <p className="text-slate-500 text-sm leading-relaxed line-clamp-2">{email.snippet}</p>
                    </div>
                    <div className="text-xs text-slate-400 shrink-0">
                      {email.date ? format(new Date(email.date), 'MMM d') : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
