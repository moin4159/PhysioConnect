const express = require('express');
const devController = require('../controllers/devController');

const router = express.Router();

router.get('/emails', devController.getEmails);
router.post('/clear-emails', devController.clearEmails);

module.exports = router;
