const express = require('express');
const db = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

router.get('/', async (req, res) => {
  const uid = req.user.id;

  const [contacts, deals, tasks, recentActivity, pipeline] = await Promise.all([
    db.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status=\'lead\') as leads, COUNT(*) FILTER (WHERE status=\'customer\') as customers FROM contacts WHERE user_id=$1', [uid]),
    db.query('SELECT COUNT(*) as total, SUM(value) as total_value, COUNT(*) FILTER (WHERE stage=\'won\') as won FROM deals WHERE user_id=$1', [uid]),
    db.query('SELECT COUNT(*) as overdue FROM tasks WHERE user_id=$1 AND completed=false AND due_date < NOW()', [uid]),
    db.query('SELECT c.name, c.company, a.type, a.description, a.created_at FROM activities a JOIN contacts c ON a.contact_id=c.id WHERE a.user_id=$1 ORDER BY a.created_at DESC LIMIT 10', [uid]),
    db.query('SELECT stage, COUNT(*) as count, COALESCE(SUM(value),0) as value FROM deals WHERE user_id=$1 GROUP BY stage', [uid])
  ]);

  res.json({
    contacts: contacts.rows[0],
    deals: deals.rows[0],
    tasks: tasks.rows[0],
    recent_activity: recentActivity.rows,
    pipeline: pipeline.rows
  });
});

module.exports = router;
