const userModel = require('../models/userModel');
const appointmentModel = require('../models/appointmentModel');
const emailModel = require('../models/emailModel');

module.exports = {
  // Book an appointment and simulate payment checkout
  bookAppointment: async (req, res) => {
    try {
      const { physioId, date, timeSlot, paymentDetails } = req.body;
      const patientId = req.userId;

      if (!physioId || !date || !timeSlot || !paymentDetails) {
        return res.status(400).json({ error: 'Incomplete booking details.' });
      }

      // Basic mock payment validation
      const { cardNumber, expiryDate, cvv } = paymentDetails;
      if (!cardNumber || !expiryDate || !cvv) {
        return res.status(400).json({ error: 'Payment card details are incomplete.' });
      }

      // Retrieve patient & therapist profile
      const users = await userModel.getUsers();
      const patient = users.find(u => u.id === patientId);
      const therapist = users.find(u => u.id === physioId);

      if (!patient) return res.status(404).json({ error: 'Patient account not found.' });
      if (!therapist) return res.status(404).json({ error: 'Physiotherapist not found.' });

      // Save booking
      const booking = await appointmentModel.createAppointment({
        patientId,
        patientName: patient.name,
        physioId,
        physioName: therapist.name,
        date,
        timeSlot,
        paymentDetails: {
          lastFourDigits: cardNumber.slice(-4),
          cardHolder: patient.name
        }
      });

      // Send mock confirmation email to both patient and therapist
      const subject = `Appointment Confirmed: ${patient.name} & ${therapist.name}`;
      const textBody = `Hi ${patient.name} and ${therapist.name},\n\nYour appointment is confirmed for ${date} at ${timeSlot} at the clinic located at ${therapist.clinicAddress}. Fee paid: $${therapist.fees}.`;
      const htmlBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f766e; margin-top: 0; border-bottom: 2px solid #0f766e; padding-bottom: 8px;">Booking Confirmed!</h2>
          <p>Dear <strong>${patient.name}</strong> & <strong>${therapist.name}</strong>,</p>
          <p>Your physiotherapy session has been successfully booked and paid for.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Date:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">${date}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Time Slot:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">${timeSlot}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Physiotherapist:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">${therapist.name} (${therapist.specialization})</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Clinic Address:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">${therapist.clinicAddress}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Amount Paid:</td>
              <td style="padding: 8px 0; text-align: right; color: #0f766e; font-weight: bold;">$${therapist.fees}</td>
            </tr>
          </table>
          <p style="color: #64748b; font-size: 0.875rem; text-align: center; margin-top: 24px;">Thank you for using the Physiotherapy Appointment System.</p>
        </div>
      `;

      // Log simulated emails to both user and therapist
      await emailModel.logEmail(patient.email, subject, textBody, htmlBody);
      await emailModel.logEmail(therapist.email, subject, textBody, htmlBody);

      res.status(201).json({
        message: 'Booking and payment successful! Confirmation email has been sent.',
        booking
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // View Patient's upcoming appointments
  getPatientAppointments: async (req, res) => {
    try {
      const list = await appointmentModel.getPatientAppointments(req.userId);
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // View Booked appointments for the day in sequence (for physiotherapists)
  getPhysioAppointments: async (req, res) => {
    try {
      const { date } = req.query;
      const physioId = req.userId;

      if (!date) {
        return res.status(400).json({ error: 'Date query parameter is required.' });
      }

      const list = await appointmentModel.getPhysioAppointments(physioId, date);
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Reorder daily appointments sequence
  reorderAppointments: async (req, res) => {
    try {
      const { date, appointmentIdsOrder } = req.body;
      const physioId = req.userId;

      if (!date || !Array.isArray(appointmentIdsOrder)) {
        return res.status(400).json({ error: 'Invalid reorder parameters. Date and order array are required.' });
      }

      const updatedList = await appointmentModel.reorderAppointments(physioId, date, appointmentIdsOrder);
      res.json({
        message: 'Appointment sequence reordered successfully!',
        appointments: updatedList
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
};
