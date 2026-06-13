const express = require('express');
const db = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

const BUILTIN_PROMPTS = [
  // Focus
  { text: "What's one thing I can do today that my future self will thank me for?", category: 'focus' },
  { text: "What's the simplest next step to move forward on my most important goal?", category: 'focus' },
  { text: "What is the ONE thing that, if done today, would make everything else easier?", category: 'focus' },
  { text: "Am I working on what matters most, or what feels most urgent?", category: 'focus' },
  { text: "What is stealing my attention right now that I should eliminate?", category: 'focus' },
  { text: "If I had only 2 hours of productive time today, what would I spend them on?", category: 'focus' },
  { text: "What is the most valuable use of my next hour?", category: 'focus' },

  // Success
  { text: "What went well recently? How can I build on that success?", category: 'success' },
  { text: "Recall a challenge you overcame. What strength did you use?", category: 'success' },
  { text: "What's a recent win, no matter how small? How did you make it happen?", category: 'success' },
  { text: "Think of someone you've helped recently. What was the impact?", category: 'success' },
  { text: "What skill have I developed or improved this month?", category: 'success' },
  { text: "Who in my life deserves more appreciation from me — and why?", category: 'success' },

  // Constructive
  { text: "What would I do today if I knew I could not fail?", category: 'constructive' },
  { text: "What am I avoiding, and what would happen if I faced it today?", category: 'constructive' },
  { text: "What new perspective could turn my current obstacle into an opportunity?", category: 'constructive' },
  { text: "What belief is holding me back — and is it actually true?", category: 'constructive' },
  { text: "What would I tell a close friend who had my exact problem?", category: 'constructive' },
  { text: "What's one thing I keep saying 'someday' about — why not today?", category: 'constructive' },
  { text: "What's the worst that could realistically happen — and could I handle it?", category: 'constructive' },

  // Problem Solving
  { text: "What's the real problem behind this problem?", category: 'problem-solving' },
  { text: "What resources do I already have that I'm not fully using?", category: 'problem-solving' },
  { text: "What would my ideal version of this solution look like?", category: 'problem-solving' },
  { text: "If I had no constraints, what solution would I choose?", category: 'problem-solving' },
  { text: "Who has solved a similar problem before, and what can I learn from them?", category: 'problem-solving' },
  { text: "What's the 20% of effort that will produce 80% of results here?", category: 'problem-solving' },
  { text: "What assumption am I making that might be wrong?", category: 'problem-solving' },

  // Direction
  { text: "Is what I'm doing right now aligned with where I want to go?", category: 'direction' },
  { text: "What thoughts am I feeding my mind today — constructive or destructive?", category: 'direction' },
  { text: "What's one small thing I can improve today that compounds over time?", category: 'direction' },
  { text: "What does the best version of me look like, and what would they do next?", category: 'direction' },
  { text: "What would my life look like in 1 year if I kept doing exactly what I'm doing now?", category: 'direction' },
  { text: "What habit, if built over 30 days, would change everything?", category: 'direction' },
  { text: "What does success look like for me specifically — not for others?", category: 'direction' },

  // Energy
  { text: "What am I telling myself about this situation — and is it helping me?", category: 'energy' },
  { text: "On a scale of 1–10, how is my energy right now? What would raise it by 2 points?", category: 'energy' },
  { text: "What would I do differently right now if I were operating at my absolute best?", category: 'energy' },
  { text: "What does my mind and body need right now to perform at their peak?", category: 'energy' },
  { text: "What am I grateful for today that I usually take for granted?", category: 'energy' },

  // Clarity
  { text: "What's the most important thing I need to decide today?", category: 'clarity' },
  { text: "What am I overthinking that I should just act on?", category: 'clarity' },
  { text: "What would simplifying this completely look like?", category: 'clarity' },
  { text: "What do I know for certain — and what am I just assuming?", category: 'clarity' },
  { text: "If I strip away all noise, what is the one truth I need to face right now?", category: 'clarity' },
  { text: "Am I playing it safe when I should be taking a smart risk?", category: 'clarity' },
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
