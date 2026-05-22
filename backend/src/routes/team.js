const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// Get team info (owner sees all members)
router.get('/', async (req, res) => {
  const user = await db.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
  const u = user.rows[0];

  // Find the team owner_id: either this user is the owner, or belongs to another team
  const ownerId = u.team_owner_id || u.id;

  const members = await db.query(
    `SELECT id, name, email, role, created_at FROM users WHERE id=$1 OR team_owner_id=$1`,
    [ownerId]
  );
  res.json({ owner_id: ownerId, members: members.rows });
});

// Invite a team member (owner only)
router.post('/invite', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password required' });

  const owner = await db.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
  const o = owner.rows[0];

  // Only owners of pro/team plans can invite
  if (o.team_owner_id) return res.status(403).json({ error: 'Only team owners can invite members' });
  if (o.subscription_plan !== 'team') return res.status(403).json({ error: 'Team plan required to add members' });

  const memberCount = await db.query(
    'SELECT COUNT(*) FROM users WHERE team_owner_id=$1', [req.user.id]
  );
  if (Number(memberCount.rows[0].count) >= 9) {
    return res.status(400).json({ error: 'Team limit of 10 users reached' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, company, team_owner_id, role)
       VALUES ($1,$2,$3,$4,$5,'member') RETURNING id, name, email, role`,
      [name, email, hash, o.company, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already in use' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove a team member
router.delete('/members/:memberId', async (req, res) => {
  const member = await db.query('SELECT * FROM users WHERE id=$1', [req.params.memberId]);
  const m = member.rows[0];

  if (!m) return res.status(404).json({ error: 'Member not found' });
  if (m.team_owner_id !== req.user.id) return res.status(403).json({ error: 'Not your team member' });

  await db.query('DELETE FROM users WHERE id=$1', [req.params.memberId]);
  res.json({ success: true });
});

module.exports = router;
