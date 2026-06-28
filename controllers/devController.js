const emailModel = require('../models/emailModel');

module.exports = {
  // Get email simulator logs
  getEmails: async (req, res) => {
    try {
      const list = await emailModel.getEmails();
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Clear email logs
  clearEmails: async (req, res) => {
    try {
      await emailModel.clearEmails();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};
