const express = require('express');
const crypto = require('crypto');
const db = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

const generateToken = (email, date, type) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET || 'secret')
    .update(`${email}:${date}:${type}`)
    .digest('hex');

const getAIResponse = async (prompt) => {
  if (!process.env.OPENAI_API_KEY) return null;
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const r = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
  });
  return r.choices[0].message.content;
};

// GET /api/checkin/verify?token=&date=&type=&email= — verify token (public)
router.get('/verify', async (req, res) => {
  const { token, date, type, email } = req.query;
  const expected = generateToken(email, date, type);
  if (token !== expected) return res.status(403).json({ error: 'Invalid token' });

  const user = await db.query('SELECT id FROM users WHERE email=$1', [email]);
  if (!user.rows[0]) return res.status(404).json({ error: 'User not found' });

  const existing = await db.query(
    'SELECT * FROM daily_checkins WHERE user_id=$1 AND checkin_date=$2 AND session_type=$3',
    [user.rows[0].id, date, type]
  );
  res.json({ valid: true, existing: existing.rows[0] || null });
});

// POST /api/checkin/submit — submit check-in (token-based, no login required)
router.post('/submit', async (req, res) => {
  const { token, date, type, email, goals, achievements, obstacles, tomorrow_priorities, mood } = req.body;
  const expected = generateToken(email, date, type);
  if (token !== expected) return res.status(403).json({ error: 'Invalid token' });

  const userRes = await db.query('SELECT id, name FROM users WHERE email=$1', [email]);
  if (!userRes.rows[0]) return res.status(404).json({ error: 'User not found' });
  const { id: userId, name: userName } = userRes.rows[0];

  // Get last 3 check-ins for comparison
  const history = await db.query(
    `SELECT * FROM daily_checkins WHERE user_id=$1 AND session_type=$2 ORDER BY checkin_date DESC LIMIT 3`,
    [userId, type]
  );

  let ai_analysis = null;
  try {
    const historyText = history.rows.map(h =>
      `${h.checkin_date}: цілі="${h.goals || '-'}", досягнення="${h.achievements || '-'}", настрій=${h.mood || '-'}/5`
    ).join('\n');

    const isMorning = type === 'morning';
    const prompt = `Ти особистий AI-коуч для ${userName}. Проаналізуй сьогоднішній ${isMorning ? 'ранковий' : 'вечірній'} check-in та порівняй з попередніми днями.

Сьогодні (${date}):
${isMorning
  ? `Цілі: ${goals || '-'}\nПріоритети: ${tomorrow_priorities || '-'}`
  : `Досягнення: ${achievements || '-'}\nПеречкоди: ${obstacles || '-'}\nПріоритети на завтра: ${tomorrow_priorities || '-'}`
}
Настрій: ${mood || '-'}/5

Попередні дні:
${historyText || 'Перший запис — немає попередніх даних для порівняння'}

Дай короткий (3-4 речення) персональний аналіз: що добре, тенденції, конкретна порада. Відповідай українською, будь підтримуючим та конкретним.`;

    ai_analysis = await getAIResponse(prompt);
  } catch (e) {
    console.error('AI analysis error:', e.message);
  }

  const result = await db.query(
    `INSERT INTO daily_checkins (user_id, checkin_date, session_type, goals, achievements, obstacles, tomorrow_priorities, mood, ai_analysis)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (user_id, checkin_date, session_type)
     DO UPDATE SET goals=$4, achievements=$5, obstacles=$6, tomorrow_priorities=$7, mood=$8, ai_analysis=$9
     RETURNING *`,
    [userId, date, type, goals || null, achievements || null, obstacles || null,
     tomorrow_priorities || null, mood || null, ai_analysis]
  );

  res.json({ checkin: result.rows[0], ai_analysis });
});

// GET /api/checkin/history — auth required
router.get('/history', auth, async (req, res) => {
  const { limit = 30 } = req.query;
  const result = await db.query(
    `SELECT * FROM daily_checkins WHERE user_id=$1 ORDER BY checkin_date DESC, session_type LIMIT $2`,
    [req.user.id, limit]
  );
  res.json(result.rows);
});

// GET /api/checkin/stats — auth required
router.get('/stats', auth, async (req, res) => {
  const result = await db.query(
    `SELECT
       ROUND(AVG(mood), 1) as avg_mood,
       COUNT(*) as total_checkins,
       COUNT(CASE WHEN session_type='morning' THEN 1 END) as morning_count,
       COUNT(CASE WHEN session_type='evening' THEN 1 END) as evening_count,
       MAX(checkin_date) as last_checkin
     FROM daily_checkins WHERE user_id=$1`,
    [req.user.id]
  );
  res.json(result.rows[0]);
});

module.exports = router;
