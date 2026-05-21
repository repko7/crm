import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../hooks/useApi';
import { format } from 'date-fns';

const StatCard = ({ label, value, sub, color }) => (
  <div className="card">
    <div className={`text-3xl font-bold ${color}`}>{value}</div>
    <div className="text-slate-600 font-medium mt-1">{label}</div>
    {sub && <div className="text-slate-400 text-sm mt-1">{sub}</div>}
  </div>
);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <div className="p-8 text-slate-500">Loading...</div>;

  const { contacts, deals, tasks, recent_activity, pipeline } = data;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Good morning, {user.name?.split(' ')[0]}!</h2>
        <p className="text-slate-500 mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard label="Total Contacts" value={contacts.total} sub={`${contacts.leads} leads`} color="text-blue-600" />
        <StatCard label="Active Deals" value={deals.total} sub={`$${Number(deals.total_value || 0).toLocaleString()} pipeline`} color="text-green-600" />
        <StatCard label="Deals Won" value={deals.won} sub="this period" color="text-emerald-600" />
        <StatCard label="Overdue Tasks" value={tasks.overdue} sub="need attention" color={tasks.overdue > 0 ? "text-red-500" : "text-slate-400"} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-4">Sales Pipeline</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pipeline}>
              <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={v => `$${Number(v).toLocaleString()}`} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-4">Recent Activity</h3>
          {recent_activity.length === 0 ? (
            <p className="text-slate-400 text-sm">No activity yet. Start by adding contacts!</p>
          ) : (
            <div className="space-y-3">
              {recent_activity.map((a, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600 shrink-0">
                    {a.name?.[0]}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-700">{a.name}</div>
                    <div className="text-xs text-slate-400">{a.description}</div>
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
