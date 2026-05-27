const express = require('express');
const db = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

const getAIResponse = async (prompt) => {
  if (!process.env.OPENAI_API_KEY) {
    return 'Для AI-коучингу потрібен OPENAI_API_KEY. Додайте його у файл .env.';
  }
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 600,
  });
  return response.choices[0].message.content;
};

// GET /api/goals — list all goals for user
router.get('/', async (req, res) => {
  const { status, date } = req.query;
  let query = 'SELECT * FROM goals WHERE user_id = $1';
  const params = [req.user.id];

  if (status) {
    params.push(status);
    query += ` AND status = $${params.length}`;
  }
  if (date) {
    params.push(date);
    query += ` AND created_at::date = $${params.length}`;
  }
  query += ' ORDER BY created_at DESC';

  const result = await db.query(query, params);
  res.json(result.rows);
});

// POST /api/goals — create a new goal
router.post('/', async (req, res) => {
  const { title, measurable, action_plan, relevance, deadline, category, session_type } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const result = await db.query(
    `INSERT INTO goals (user_id, title, measurable, action_plan, relevance, deadline, category, session_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.user.id, title, measurable || null, action_plan || null, relevance || null,
     deadline || null, category || 'personal', session_type || 'morning']
  );
  res.status(201).json(result.rows[0]);
});

// PUT /api/goals/:id — update goal
router.put('/:id', async (req, res) => {
  const { title, measurable, action_plan, relevance, deadline, category, status, progress_notes, session_type } = req.body;
  const result = await db.query(
    `UPDATE goals SET
       title = COALESCE($1, title),
       measurable = COALESCE($2, measurable),
       action_plan = COALESCE($3, action_plan),
       relevance = COALESCE($4, relevance),
       deadline = COALESCE($5, deadline),
       category = COALESCE($6, category),
       status = COALESCE($7, status),
       progress_notes = COALESCE($8, progress_notes),
       session_type = COALESCE($9, session_type),
       updated_at = NOW()
     WHERE id = $10 AND user_id = $11
     RETURNING *`,
    [title, measurable, action_plan, relevance, deadline, category, status, progress_notes, session_type,
     req.params.id, req.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

// DELETE /api/goals/:id
router.delete('/:id', async (req, res) => {
  await db.query('DELETE FROM goals WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

// POST /api/goals/:id/coach — AI SMART coaching for a goal
router.post('/:id/coach', async (req, res) => {
  const goal = await db.query('SELECT * FROM goals WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  if (!goal.rows[0]) return res.status(404).json({ error: 'Not found' });

  const g = goal.rows[0];
  const user = await db.query('SELECT name FROM users WHERE id=$1', [req.user.id]);
  const userName = user.rows[0]?.name || 'Олег';

  const prompt = `Ти особистий коуч із планування цілей за методологією SMART.
Ім'я користувача: ${userName}

Ціль: "${g.title}"
Вимірюваність: ${g.measurable || 'не вказано'}
План дій: ${g.action_plan || 'не вказано'}
Актуальність: ${g.relevance || 'не вказано'}
Дедлайн: ${g.deadline || 'не вказано'}
Категорія: ${g.category}

Проаналізуй ціль за критеріями SMART (Specific, Measurable, Achievable, Relevant, Time-bound).
Дай конкретні рекомендації як покращити кожен критерій. Відповідай українською мовою.
Будь підтримуючим і надихаючим. Максимум 5 коротких пунктів.`;

  const feedback = await getAIResponse(prompt);
  await db.query('UPDATE goals SET ai_feedback=$1, updated_at=NOW() WHERE id=$2', [feedback, g.id]);
  res.json({ feedback });
});

// GET /api/goals/settings — get user's goal reminder settings
router.get('/settings', async (req, res) => {
  const result = await db.query(
    `SELECT goal_reminder_enabled, goal_reminder_morning, goal_reminder_evening, goal_reminder_timezone
     FROM users WHERE id=$1`,
    [req.user.id]
  );
  res.json(result.rows[0] || {});
});

// PUT /api/goals/settings — update goal reminder settings
router.put('/settings', async (req, res) => {
  const { goal_reminder_enabled, goal_reminder_morning, goal_reminder_evening, goal_reminder_timezone } = req.body;
  await db.query(
    `UPDATE users SET
       goal_reminder_enabled = COALESCE($1, goal_reminder_enabled),
       goal_reminder_morning = COALESCE($2, goal_reminder_morning),
       goal_reminder_evening = COALESCE($3, goal_reminder_evening),
       goal_reminder_timezone = COALESCE($4, goal_reminder_timezone)
     WHERE id=$5`,
    [goal_reminder_enabled, goal_reminder_morning, goal_reminder_evening, goal_reminder_timezone, req.user.id]
  );
  res.json({ success: true });
});

module.exports = router;
