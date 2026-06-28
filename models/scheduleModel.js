const db = require('../database');

module.exports = {
  // Get active schedule for a physiotherapist
  getSchedule: (physioId) => db.dbQueue.enqueue(async () => {
    const data = await db.rawRead();
    let schedule = data.schedules.find(s => s.physioId === physioId);
    if (!schedule) {
      // Return a default blank schedule
      schedule = {
        physioId,
        slots: [],
        daysOff: [],
        fees: 0
      };
    }
    return schedule;
  }),

  // Create or update physiotherapist schedule
  updateSchedule: (physioId, scheduleData) => db.dbQueue.enqueue(async () => {
    const data = await db.rawRead();
    let index = data.schedules.findIndex(s => s.physioId === physioId);

    const updatedSchedule = {
      physioId,
      slots: scheduleData.slots || [], // Array of time strings like ["09:00 AM", "10:00 AM"]
      daysOff: scheduleData.daysOff || [], // Array of date strings like ["2026-06-12"]
      fees: Number(scheduleData.fees) || 0
    };

    if (index > -1) {
      data.schedules[index] = updatedSchedule;
    } else {
      data.schedules.push(updatedSchedule);
    }

    // Also update the fee inside the user table for this physiotherapist
    const physio = data.users.find(u => u.id === physioId);
    if (physio) {
      physio.fees = updatedSchedule.fees;
    }

    await db.rawWrite(data);
    return updatedSchedule;
  })
};
