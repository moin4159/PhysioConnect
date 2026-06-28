const userModel = require('../models/userModel');
const scheduleModel = require('../models/scheduleModel');
const appointmentModel = require('../models/appointmentModel');

module.exports = {
  // List all physiotherapists
  listPhysiotherapists: async (req, res) => {
    try {
      const list = await userModel.getPhysiotherapists();
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get specific physiotherapist schedule availability for a date
  getScheduleAvailability: async (req, res) => {
    try {
      const physioId = req.params.id;
      const { date } = req.query; // Expects date format "YYYY-MM-DD" or "none"/"any"

      const schedule = await scheduleModel.getSchedule(physioId);

      // If no specific date is provided or date is 'none'/'any', return the raw settings directly
      if (!date || date === 'none' || date === 'any') {
        return res.json({
          physioId,
          slots: schedule.slots,
          daysOff: schedule.daysOff,
          fees: schedule.fees
        });
      }

      const appointments = await appointmentModel.getAppointments();
      const isDayOff = schedule.daysOff.includes(date);

      // Map slots and attach booked status
      const formattedSlots = schedule.slots.map(slot => {
        const isBooked = appointments.some(
          a => a.physioId === physioId && a.date === date && a.timeSlot === slot && a.status !== 'cancelled'
        );
        return {
          time: slot,
          booked: isBooked
        };
      });

      res.json({
        physioId,
        date,
        isDayOff,
        fees: schedule.fees,
        slots: formattedSlots,
        daysOff: schedule.daysOff
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Setup or update daily appointment slots, fees, days off
  updateSchedule: async (req, res) => {
    try {
      const { slots, daysOff, fees } = req.body;
      const physioId = req.userId;

      // Verify user is a physiotherapist
      const users = await userModel.getUsers();
      const physio = users.find(u => u.id === physioId);
      if (!physio || physio.role !== 'physiotherapist') {
        return res.status(403).json({ error: 'Access denied. Account is not a physiotherapist.' });
      }

      const schedule = await scheduleModel.updateSchedule(physioId, { slots, daysOff, fees });
      res.json({
        message: 'Schedule updated successfully!',
        schedule
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
};
