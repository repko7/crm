const express = require('express');
const { google } = require('googleapis');
const db = require('../models/db');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

const getOAuthClient = () => new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Step 1: Get Google OAuth URL
router.get('/gmail/auth-url', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Gmail integration not configured' });
  }
  const oAuth2Client = getOAuthClient();
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    state: req.user.id.toString(),
  });
  res.json({ url });
});

// Step 2: OAuth callback — exchange code for tokens
router.get('/gmail/callback', async (req, res) => {
  const { code, state: userId } = req.query;
  try {
    const oAuth2Client = getOAuthClient();
    const { tokens } = await oAuth2Client.getToken(code);
    await db.query(
      'UPDATE users SET gmail_tokens=$1 WHERE id=$2',
      [JSON.stringify(tokens), userId]
    );
    res.redirect(`${process.env.FRONTEND_URL}/emails?connected=gmail`);
  } catch (err) {
    res.redirect(`${process.env.FRONTEND_URL}/emails?error=auth_failed`);
  }
});

// Get emails for a specific contact
router.get('/contact/:contactId', async (req, res) => {
  const contactResult = await db.query(
    'SELECT * FROM contacts WHERE id=$1 AND user_id=$2',
    [req.params.contactId, req.user.id]
  );
  const contact = contactResult.rows[0];
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const userResult = await db.query('SELECT gmail_tokens FROM users WHERE id=$1', [req.user.id]);
  const tokens = userResult.rows[0]?.gmail_tokens;

  if (!tokens) return res.json({ emails: [], connected: false });

  try {
    const oAuth2Client = getOAuthClient();
    oAuth2Client.setCredentials(typeof tokens === 'string' ? JSON.parse(tokens) : tokens);
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const query = contact.email ? `from:${contact.email} OR to:${contact.email}` : `${contact.name}`;
    const list = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 20,
    });

    const messages = await Promise.all(
      (list.data.messages || []).map(async msg => {
        const full = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        });
        const headers = full.data.payload.headers;
        const get = name => headers.find(h => h.name === name)?.value || '';
        return {
          id: msg.id,
          from: get('From'),
          to: get('To'),
          subject: get('Subject'),
          date: get('Date'),
          snippet: full.data.snippet,
        };
      })
    );

    res.json({ emails: messages, connected: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch emails', details: err.message });
  }
});

// Check connection status
router.get('/status', async (req, res) => {
  const result = await db.query('SELECT gmail_tokens FROM users WHERE id=$1', [req.user.id]);
  const connected = !!result.rows[0]?.gmail_tokens;
  res.json({ gmail: connected });
});

// Disconnect Gmail
router.delete('/gmail', async (req, res) => {
  await db.query('UPDATE users SET gmail_tokens=NULL WHERE id=$1', [req.user.id]);
  res.json({ success: true });
});

module.exports = router;
