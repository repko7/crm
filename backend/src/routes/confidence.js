const express = require('express');
const db = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

const TYPES = ['win', 'strength', 'weakness'];

router.use(auth);

router.get('/summary', async (req, res) => {
  const uid = req.user.id;

  const [counts, randomWin] = await Promise.all([
    db.query(
      `SELECT type, COUNT(*) as count FROM confidence_entries WHERE user_id=$1 GROUP BY type`,
      [uid]
    ),
    db.query(
      `SELECT * FROM confidence_entries WHERE user_id=$1 AND type='win' ORDER BY random() LIMIT 1`,
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
    recall: randomWin.rows[0] || null
  });
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
