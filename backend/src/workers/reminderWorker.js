require('dotenv').config();
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const processReminders = async () => {
  const due = await pool.query(
    `SELECT r.*, u.email as user_email, u.name as user_name, c.name as contact_name
     FROM reminders r
     JOIN users u ON r.user_id = u.id
     LEFT JOIN contacts c ON r.contact_id = c.id
     WHERE r.remind_at <= NOW() AND r.sent = FALSE`
  );

  for (const reminder of due.rows) {
    try {
      if (reminder.channel === 'email' && process.env.SMTP_USER) {
        await transport.sendMail({
          from: `"CRM Pro" <${process.env.SMTP_USER}>`,
          to: reminder.user_email,
          subject: `Reminder: ${reminder.message}`,
          html: `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
              <h2 style="color:#1e40af">⏰ CRM Pro Reminder</h2>
              <p style="font-size:16px">${reminder.message}</p>
              ${reminder.contact_name ? `<p><strong>Contact:</strong> ${reminder.contact_name}</p>` : ''}
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
              <p style="color:#64748b;font-size:12px">CRM Pro · Your AI Sales Assistant</p>
            </div>`,
        });
      }
      await pool.query('UPDATE reminders SET sent=TRUE WHERE id=$1', [reminder.id]);
      console.log(`Sent reminder ${reminder.id} to ${reminder.user_email}`);
    } catch (err) {
      console.error(`Failed reminder ${reminder.id}:`, err.message);
    }
  }
};

// Run every 60 seconds
const run = async () => {
  console.log('Reminder worker started');
  while (true) {
    try {
      await processReminders();
    } catch (err) {
      console.error('Worker error:', err.message);
    }
    await new Promise(r => setTimeout(r, 60_000));
  }
};

run();
