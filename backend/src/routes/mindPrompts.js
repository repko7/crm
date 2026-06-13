const express = require('express');
const db = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

const BUILTIN_PROMPTS = [
  { text: "What's one thing I can do today that my future self will thank me for?", category: 'focus' },
  { text: "What went well recently? How can I build on that success?", category: 'success' },
  { text: "What's the simplest next step to move forward on my most important goal?", category: 'focus' },
  { text: "Recall a challenge you overcame. What strength did you use?", category: 'success' },
  { text: "What's a recent win, no matter how small? How did you make it happen?", category: 'success' },
  { text: "What is the ONE thing that, if done today, would make everything else easier?", category: 'focus' },
  { text: "Am I working on what matters most, or what feels most urgent?", category: 'focus' },
  { text: "What would I do today if I knew I could not fail?", category: 'constructive' },
  { text: "What's the real problem behind this problem?", category: 'problem-solving' },
  { text: "What resources do I already have that I'm not fully using?", category: 'problem-solving' },
  { text: "What would my ideal version of this solution look like?", category: 'problem-solving' },
  { text: "Is what I'm doing right now aligned with where I want to go?", category: 'direction' },
  { text: "What thoughts am I feeding my mind today — constructive or destructive?", category: 'direction' },
  { text: "What's one small thing I can improve today that compounds over time?", category: 'direction' },
  { text: "Think of someone you've helped recently. What was the impact?", category: 'success' },
  { text: "What am I avoiding, and what would happen if I faced it today?", category: 'constructive' },
  { text: "What new perspective could turn my current obstacle into an opportunity?", category: 'constructive' },
  { text: "What does the best version of me look like, and what would they do next?", category: 'direction' },
];

async function ensureBuiltins(userId) {
  const existing = await db.query(
    'SELECT COUNT(*) FROM mind_prompts WHERE user_id=$1 AND is_builtin=TRUE',
    [userId]
  );
  if (parseInt(existing.rows[0].count) === 0) {
    const values = BUILTIN_PROMPTS.map((_, i) => {
      const base = i * 3;
      return `($${base + 1}, $${base + 2}, $${base + 3}, TRUE)`;
    }).join(',');
    const params = BUILTIN_PROMPTS.flatMap(p => [userId, p.text, p.category]);
    await db.query(
      `INSERT INTO mind_prompts (user_id, text, category, is_builtin) VALUES ${values}`,
      params
    );
  }
}

router.get('/', async (req, res) => {
  await ensureBuiltins(req.user.id);
  const { category } = req.query;
  let query = 'SELECT * FROM mind_prompts WHERE user_id=$1';
  const params = [req.user.id];
  if (category && category !== 'all') {
    params.push(category);
    query += ` AND category=$${params.length}`;
  }
  query += ' ORDER BY is_favorite DESC, is_builtin ASC, created_at DESC';
  const result = await db.query(query, params);
  res.json(result.rows);
});

router.get('/daily', async (req, res) => {
  await ensureBuiltins(req.user.id);
  const result = await db.query(
    `SELECT * FROM mind_prompts WHERE user_id=$1
     ORDER BY times_used ASC, RANDOM() LIMIT 1`,
    [req.user.id]
  );
  res.json(result.rows[0] || null);
});

router.post('/', async (req, res) => {
  const { text, category } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required' });
  const result = await db.query(
    'INSERT INTO mind_prompts (user_id, text, category) VALUES ($1, $2, $3) RETURNING *',
    [req.user.id, text.trim(), category || 'custom']
  );
  res.status(201).json(result.rows[0]);
});

router.put('/:id/use', async (req, res) => {
  const result = await db.query(
    `UPDATE mind_prompts SET times_used=times_used+1, last_used_at=NOW()
     WHERE id=$1 AND user_id=$2 RETURNING *`,
    [req.params.id, req.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

router.put('/:id/favorite', async (req, res) => {
  const result = await db.query(
    `UPDATE mind_prompts SET is_favorite=NOT is_favorite
     WHERE id=$1 AND user_id=$2 RETURNING *`,
    [req.params.id, req.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

router.delete('/:id', async (req, res) => {
  const prompt = await db.query(
    'SELECT * FROM mind_prompts WHERE id=$1 AND user_id=$2',
    [req.params.id, req.user.id]
  );
  if (!prompt.rows[0]) return res.status(404).json({ error: 'Not found' });
  if (prompt.rows[0].is_builtin) return res.status(403).json({ error: 'Cannot delete built-in prompts' });
  await db.query('DELETE FROM mind_prompts WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

module.exports = router;
