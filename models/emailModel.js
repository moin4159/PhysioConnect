const crypto = require('crypto');
const db = require('../database');

module.exports = {
  // Add log to developer email simulator
  logEmail: (to, subject, body, html) => db.dbQueue.enqueue(async () => {
    const data = await db.rawRead();
    const newEmail = {
      id: crypto.randomUUID(),
      to,
      subject,
      body,
      html,
      sentAt: new Date().toISOString()
    };
    data.emails.push(newEmail);
    // Keep max 100 emails in simulator logs
    if (data.emails.length > 100) {
      data.emails.shift();
    }
    await db.rawWrite(data);
    return newEmail;
  }),

  // Get email simulator logs
  getEmails: () => db.dbQueue.enqueue(async () => {
    const data = await db.rawRead();
    return [...data.emails].reverse(); // newest first
  }),

  // Clear email logs
  clearEmails: () => db.dbQueue.enqueue(async () => {
    const data = await db.rawRead();
    data.emails = [];
    await db.rawWrite(data);
    return true;
  })
};
