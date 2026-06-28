const crypto = require('crypto');
const db = require('../database');

// Helper utility to convert "09:00 AM" to "09:00" for proper chronological sorting
function convert12hTo24h(timeStr) {
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':');
  if (hours === '12') {
    hours = '00';
  }
  if (modifier === 'PM') {
    hours = parseInt(hours, 10) + 12;
  }
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

module.exports = {
  // Get all appointments
  getAppointments: () => db.dbQueue.enqueue(async () => {
    const data = await db.rawRead();
    return data.appointments;
  }),

  // Create a new appointment booking
  createAppointment: (bookingData) => db.dbQueue.enqueue(async () => {
    const data = await db.rawRead();

    // Check if slot is already booked for this therapist on the date
    const isBooked = data.appointments.some(
      a => a.physioId === bookingData.physioId &&
           a.date === bookingData.date &&
           a.timeSlot === bookingData.timeSlot &&
           a.status !== 'cancelled'
    );

    if (isBooked) {
      throw new Error('This time slot is already booked.');
    }

    // Determine the sequence index for this therapist for the given date.
    const todaysBookings = data.appointments.filter(
      a => a.physioId === bookingData.physioId && a.date === bookingData.date
    );
    const sequenceIndex = todaysBookings.length;

    const newAppointment = {
      id: crypto.randomUUID(),
      patientId: bookingData.patientId,
      patientName: bookingData.patientName,
      physioId: bookingData.physioId,
      physioName: bookingData.physioName,
      date: bookingData.date, // YYYY-MM-DD
      timeSlot: bookingData.timeSlot,
      sequenceIndex,
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentDetails: bookingData.paymentDetails,
      createdAt: new Date().toISOString()
    };

    data.appointments.push(newAppointment);
    await db.rawWrite(data);
    return newAppointment;
  }),

  // Get appointments for a patient
  getPatientAppointments: (patientId) => db.dbQueue.enqueue(async () => {
    const data = await db.rawRead();
    return data.appointments
      .filter(a => a.patientId === patientId)
      .sort((a, b) => new Date(a.date + 'T' + convert12hTo24h(a.timeSlot)) - new Date(b.date + 'T' + convert12hTo24h(b.timeSlot)));
  }),

  // Get appointments for a physiotherapist on a specific date (sequence sorted)
  getPhysioAppointments: (physioId, date) => db.dbQueue.enqueue(async () => {
    const data = await db.rawRead();
    return data.appointments
      .filter(a => a.physioId === physioId && a.date === date && a.status !== 'cancelled')
      .sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  }),

  // Reorder daily appointments sequence for a physiotherapist
  reorderAppointments: (physioId, date, appointmentIdsOrder) => db.dbQueue.enqueue(async () => {
    const data = await db.rawRead();

    // Map through existing appointments and update sequenceIndex based on the provided IDs list order
    let updatedCount = 0;
    data.appointments.forEach(a => {
      if (a.physioId === physioId && a.date === date) {
        const index = appointmentIdsOrder.indexOf(a.id);
        if (index > -1) {
          a.sequenceIndex = index;
          updatedCount++;
        }
      }
    });

    if (updatedCount > 0) {
      await db.rawWrite(data);
    }
    
    return data.appointments
      .filter(a => a.physioId === physioId && a.date === date && a.status !== 'cancelled')
      .sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  })
};
