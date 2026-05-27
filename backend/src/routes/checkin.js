const express = require('express');
const crypto = require('crypto');
const db = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

const generateToken = (userId, date, type) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET || 'secret')
    .update(`${userId}:${date}:${type}`)
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

// POST /api/checkin/token — generate a magic link token (internal, SERVICE_KEY)
router.post('/token', async (req, res) => {
  if (req.headers['x-service-key'] !== process.env.SERVICE_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { user_id, date, type } = req.body;
  const token = generateToken(user_id, date, type);
  res.json({ token });
});

// GET /api/checkin/verify?token=&date=&type=&uid= — verify token (public)
router.get('/verify', async (req, res) => {
  const { token, date, type, uid } = req.query;
  const expected = generateToken(uid, date, type);
  if (token !== expected) return res.status(403).json({ error: 'Invalid token' });

  const existing = await db.query(
    'SELECT * FROM daily_checkins WHERE user_id=$1 AND checkin_date=$2 AND session_type=$3',
    [uid, date, type]
  );
  res.json({ valid: true, existing: existing.rows[0] || null });
});

// POST /api/checkin/submit — submit check-in (token-based, no login required)
router.post('/submit', async (req, res) => {
  const { token, date, type, uid, goals, achievements, obstacles, tomorrow_priorities, mood } = req.body;
  const expected = generateToken(uid, date, type);
  if (token !== expected) return res.status(403).json({ error: 'Invalid token' });

  const user = await db.query('SELECT name FROM users WHERE id=$1', [uid]);
  const userName = user.rows[0]?.name || 'Олег';

  // Get last 3 check-ins for comparison
  const history = await db.query(
    `SELECT * FROM daily_checkins
     WHERE user_id=$1 AND session_type=$2
     ORDER BY checkin_date DESC LIMIT 3`,
    [uid, type]
  );

  let ai_analysis = null;
  try {
    const historyText = history.rows.map(h =>
      `${h.checkin_date}: цілі="${h.goals || '-'}", досягнення="${h.achievements || '-'}", настрій=${h.mood || '-'}`
    ).join('\n');

    const isMorning = type === 'morning';
    const prompt = `Ти особистий AI-коуч для ${userName}. Проаналізуй сьогоднішній ${isMorning ? 'ранковий' : 'вечірній'} check-in та порівняй з попередніми днями.

Сьогодні (${date}):
${isMorning ? `Цілі: ${goals || '-'}` : `Досягнення: ${achievements || '-'}\nПеречкоди: ${obstacles || '-'}\nПріоритети на завтра: ${tomorrow_priorities || '-'}`}
Настрій: ${mood || '-'}/5

Попередні дні:
${historyText || 'Немає попередніх записів'}

Дай короткий (3-4 речення) персональний аналіз: що добре, що покращити, тенденції. Відповідай українською, будь підтримуючим і конкретним.`;

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
    [uid, date, type, goals || null, achievements || null, obstacles || null, tomorrow_priorities || null, mood || null, ai_analysis]
  );

  res.json({ checkin: result.rows[0], ai_analysis });
});

// GET /api/checkin/history — auth required, returns history with stats
router.get('/history', auth, async (req, res) => {
  const { limit = 30 } = req.query;
  const result = await db.query(
    `SELECT * FROM daily_checkins WHERE user_id=$1 ORDER BY checkin_date DESC, session_type LIMIT $2`,
    [req.user.id, limit]
  );
  res.json(result.rows);
});

// GET /api/checkin/stats — auth required, returns mood/completion stats
router.get('/stats', auth, async (req, res) => {
  const result = await db.query(
    `SELECT
       AVG(mood) as avg_mood,
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
