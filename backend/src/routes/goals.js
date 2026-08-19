const express = require('express');
const db = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

const today = () => new Date().toISOString().slice(0, 10);

// GET /api/goals?date=YYYY-MM-DD -> the 10-goals list for that day (default today)
router.get('/', async (req, res) => {
  const date = req.query.date || today();
  const result = await db.query(
    'SELECT * FROM daily_goals WHERE user_id=$1 AND goal_date=$2 ORDER BY position ASC',
    [req.user.id, date]
  );
  res.json(result.rows);
});

// GET /api/goals/dates -> days that have a saved list, most recent first
router.get('/dates', async (req, res) => {
  const result = await db.query(
    'SELECT DISTINCT goal_date FROM daily_goals WHERE user_id=$1 ORDER BY goal_date DESC LIMIT 60',
    [req.user.id]
  );
  res.json(result.rows.map(r => r.goal_date));
});

// GET /api/goals/recurring -> goals repeated across multiple days (the technique's core signal of true priorities)
router.get('/recurring', async (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 30, 90);
  const result = await db.query(
    `SELECT LOWER(TRIM(text)) as normalized, MIN(text) as text, COUNT(DISTINCT goal_date) as day_count,
            MAX(goal_date) as last_seen
     FROM daily_goals
     WHERE user_id=$1 AND goal_date >= (CURRENT_DATE - $2::int)
     GROUP BY LOWER(TRIM(text))
     HAVING COUNT(DISTINCT goal_date) > 1
     ORDER BY day_count DESC, last_seen DESC
     LIMIT 10`,
    [req.user.id, days]
  );
  res.json(result.rows);
});

// POST /api/goals -> save/replace the list for a day (max 10, written fresh each time)
router.post('/', async (req, res) => {
  const { date, goals } = req.body;
  const goalDate = date || today();
  if (!Array.isArray(goals) || goals.length === 0) {
    return res.status(400).json({ error: 'Goals array is required' });
  }
  const cleaned = goals.map(g => (g || '').trim()).filter(Boolean).slice(0, 10);
  if (cleaned.length === 0) return res.status(400).json({ error: 'At least one goal is required' });

  await db.query('DELETE FROM daily_goals WHERE user_id=$1 AND goal_date=$2', [req.user.id, goalDate]);

  const inserted = [];
  for (let i = 0; i < cleaned.length; i++) {
    const result = await db.query(
      'INSERT INTO daily_goals (user_id,goal_date,position,text) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, goalDate, i + 1, cleaned[i]]
    );
    inserted.push(result.rows[0]);
  }
  res.status(201).json(inserted);
});

// PUT /api/goals/:id -> mark a goal achieved/not achieved
router.put('/:id', async (req, res) => {
  const { achieved } = req.body;
  const result = await db.query(
    'UPDATE daily_goals SET achieved=$1 WHERE id=$2 AND user_id=$3 RETURNING *',
    [achieved, req.params.id, req.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

router.delete('/:id', async (req, res) => {
  await db.query('DELETE FROM daily_goals WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

module.exports = router;
