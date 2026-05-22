require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const contactsRoutes = require('./routes/contacts');
const dealsRoutes = require('./routes/deals');
const tasksRoutes = require('./routes/tasks');
const aiRoutes = require('./routes/ai');
const dashboardRoutes = require('./routes/dashboard');
const billingRoutes = require('./routes/billing');
const emailRoutes = require('./routes/email');
const remindersRoutes = require('./routes/reminders');
const teamRoutes = require('./routes/team');
const { router: publicApiRoutes } = require('./routes/publicApi');

const app = express();

// Stripe webhook needs raw body — must be before express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/team', teamRoutes);
app.use('/api', publicApiRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`CRM backend running on port ${PORT}`));
