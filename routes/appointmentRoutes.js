const express = require('express');
const appointmentController = require('../controllers/appointmentController');
const physioController = require('../controllers/physioController');
const verifyRequest = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/appointments/book', verifyRequest, appointmentController.bookAppointment);
router.get('/patient/appointments', verifyRequest, appointmentController.getPatientAppointments);
router.get('/physio/appointments', verifyRequest, appointmentController.getPhysioAppointments);
router.post('/physio/appointments/reorder', verifyRequest, appointmentController.reorderAppointments);
router.post('/physio/schedule/update', verifyRequest, physioController.updateSchedule);

module.exports = router;
