const express = require('express');
const physioController = require('../controllers/physioController');

const router = express.Router();

router.get('/', physioController.listPhysiotherapists);
router.get('/:id/schedule', physioController.getScheduleAvailability);

module.exports = router;
