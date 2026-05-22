const express = require('express');
const db = require('../models/db');
const auth = require('../middleware/auth');
const { runCycle } = require('../agent/agent');

const router = express.Router();
router.use(auth);

// GET /api/agent/logs — last 20 agent cycles for this user
router.get('/logs', async (req, res) => {
  const logs = await db.query(
    `SELECT id, cycle_at, tasks_created, summary, details
     FROM agent_logs
     WHERE user_id = $1
     ORDER BY cycle_at DESC
     LIMIT 20`,
    [req.user.id]
  );
  res.json(logs.rows);
});

// POST /api/agent/run — manually trigger a cycle (useful for testing)
router.post('/run', async (req, res) => {
  try {
    await runCycle();
    res.json({ ok: true, message: 'Agent cycle completed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
