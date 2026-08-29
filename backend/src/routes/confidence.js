const express = require('express');
const db = require('../models/db');
const auth = require('../middleware/auth');
const { getAIResponse } = require('../utils/openai');
const router = express.Router();

const TYPES = ['win', 'strength', 'weakness'];
const TYPE_LABELS = { win: 'Перемога', strength: 'Сильна сторона', weakness: 'Зона росту' };

router.use(auth);

// Longest run of consecutive calendar days (ending today or yesterday) with at least one entry
function computeStreak(isoDates) {
  if (!isoDates.length) return 0;

  const dayMs = 24 * 60 * 60 * 1000;
  const toUTC = s => Date.parse(`${s}T00:00:00Z`);
  const today = toUTC(new Date().toISOString().slice(0, 10));

  let expected = toUTC(isoDates[0]);
  if (today - expected > dayMs) return 0; // most recent entry is older than yesterday — streak broken

  let streak = 0;
  for (const iso of isoDates) {
    const t = toUTC(iso);
    if (t === expected) {
      streak++;
      expected -= dayMs;
    } else if (t < expected) {
      break;
    }
  }
  return streak;
}

router.get('/summary', async (req, res) => {
  const uid = req.user.id;

  const [counts, randomWin, dates] = await Promise.all([
    db.query(
      `SELECT type, COUNT(*) as count FROM confidence_entries WHERE user_id=$1 GROUP BY type`,
      [uid]
    ),
    db.query(
      `SELECT * FROM confidence_entries WHERE user_id=$1 AND type='win' ORDER BY random() LIMIT 1`,
      [uid]
    ),
    db.query(
      `SELECT DISTINCT entry_date::text as d FROM confidence_entries WHERE user_id=$1 ORDER BY d DESC`,
      [uid]
    )
  ]);

  const byType = { win: 0, strength: 0, weakness: 0 };
  counts.rows.forEach(r => { byType[r.type] = parseInt(r.count, 10); });

  const total = byType.win + byType.strength + byType.weakness;
  const confidence_score = total === 0
    ? 0
    : Math.round(((byType.win + byType.strength) / total) * 100);

  res.json({
    counts: byType,
    confidence_score,
    streak: computeStreak(dates.rows.map(r => r.d)),
    recall: randomWin.rows[0] || null
  });
});

router.post('/recap', async (req, res) => {
  const uid = req.user.id;

  const result = await db.query(
    `SELECT type, title, description, entry_date FROM confidence_entries
     WHERE user_id=$1 AND entry_date >= CURRENT_DATE - INTERVAL '7 days'
     ORDER BY entry_date ASC`,
    [uid]
  );

  if (result.rows.length === 0) {
    return res.json({ recap: 'За останній тиждень поки немає записів. Додай хоча б один — і за тиждень тут з’явиться підсумок.' });
  }

  const entriesText = result.rows
    .map(e => `- [${TYPE_LABELS[e.type]}] ${e.title}${e.description ? ': ' + e.description : ''}`)
    .join('\n');

  const prompt = `Ти — теплий, підтримуючий коуч з розвитку впевненості в собі. Ось записи людини за останній тиждень (перемоги, сильні сторони, зони росту):
${entriesText}

Напиши короткий (3-5 речень) підсумок тижня українською мовою. Відзнач конкретні перемоги та сильні сторони по імені, згадай зони росту без осуду — як напрямок для розвитку, а не недолік. Тон — щирий, підбадьорливий, без загальних фраз і кліше.`;

  const recap = await getAIResponse(prompt);
  res.json({ recap });
});

router.get('/', async (req, res) => {
  const { type } = req.query;
  let query = 'SELECT * FROM confidence_entries WHERE user_id=$1';
  const params = [req.user.id];

  if (type && TYPES.includes(type)) {
    params.push(type);
    query += ` AND type=$${params.length}`;
  }
  query += ' ORDER BY entry_date DESC, created_at DESC';

  const result = await db.query(query, params);
  res.json(result.rows);
});

router.post('/', async (req, res) => {
  const { type, title, description, entry_date } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  if (type && !TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });

  const result = await db.query(
    `INSERT INTO confidence_entries (user_id, type, title, description, entry_date)
     VALUES ($1,$2,$3,$4,COALESCE($5, CURRENT_DATE)) RETURNING *`,
    [req.user.id, type || 'win', title, description, entry_date || null]
  );
  res.status(201).json(result.rows[0]);
});

router.put('/:id', async (req, res) => {
  const { type, title, description, entry_date } = req.body;
  if (type && !TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });

  const result = await db.query(
    `UPDATE confidence_entries SET type=$1, title=$2, description=$3, entry_date=$4
     WHERE id=$5 AND user_id=$6 RETURNING *`,
    [type || 'win', title, description, entry_date, req.params.id, req.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

router.delete('/:id', async (req, res) => {
  await db.query('DELETE FROM confidence_entries WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

module.exports = router;
