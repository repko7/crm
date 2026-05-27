import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import Deals from './pages/Deals';
import Tasks from './pages/Tasks';
import AIAssistant from './pages/AIAssistant';
import Emails from './pages/Emails';
import Billing from './pages/Billing';
import Reminders from './pages/Reminders';
import Settings from './pages/Settings';
import Goals from './pages/Goals';

const isAuthenticated = () => !!localStorage.getItem('token');

const PrivateRoute = ({ children }) =>
  isAuthenticated() ? children : <Navigate to="/login" />;

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={isAuthenticated() ? <Navigate to="/dashboard" /> : <Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/ai" element={<AIAssistant />} />
          <Route path="/emails" element={<Emails />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/billing/success" element={<Billing />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
