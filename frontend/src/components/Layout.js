import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊', end: true },
  { to: '/goals', label: 'Мої цілі', icon: '🎯' },
  { to: '/contacts', label: 'Contacts', icon: '👥' },
  { to: '/deals', label: 'Deals', icon: '💼' },
  { to: '/tasks', label: 'Tasks', icon: '✅' },
  { to: '/emails', label: 'Email', icon: '📧' },
  { to: '/reminders', label: 'Reminders', icon: '⏰' },
  { to: '/ai', label: 'AI Assistant', icon: '🤖' },
  { to: '/billing', label: 'Billing', icon: '💳' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-64 bg-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-white font-bold text-xl">CRM Pro</h1>
          <p className="text-slate-400 text-sm mt-1">AI-Native CRM</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span role="img" aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <div className="text-slate-300 text-sm font-medium">{user.name}</div>
          <div className="text-slate-500 text-xs">{user.email}</div>
          <button onClick={logout} className="mt-3 text-slate-400 hover:text-white text-sm transition-colors">
            Sign out →
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
