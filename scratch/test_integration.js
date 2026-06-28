const http = require('http');

const PORT = 3000;

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: body ? JSON.parse(body) : null
          });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', (e) => reject(e));

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runIntegrationTest() {
  console.log('========================================================');
  console.log('     RUNNING END-TO-END SYSTEM INTEGRATION TESTS        ');
  console.log('========================================================');

  const timestamp = Date.now();
  const patientEmail = `patient.${timestamp}@test.com`;
  const therapistEmail = `therapist.${timestamp}@test.com`;
  const testDate = '2026-06-20';

  let patientId = '';
  let therapistId = '';
  let appointmentId1 = '';
  let appointmentId2 = '';

  try {
    // -----------------------------------------------------------------
    // STEP 1: ONBOARD PATIENT (Registration & Simulator Verification)
    // -----------------------------------------------------------------
    console.log('\n[Step 1] Registering Patient...');
    const regPatient = await request({
      hostname: 'localhost', port: PORT, path: '/api/auth/signup', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      role: 'user', name: 'John Patient', email: patientEmail, password: 'password123',
      contactNumber: '+1 555-100-2000', age: 30, gender: 'Male'
    });

    if (regPatient.status !== 201) throw new Error(`Patient registration failed: ${JSON.stringify(regPatient.body)}`);
    const patientToken = regPatient.body.user.verificationToken;
    console.log('  -> Patient registered (unverified). Token:', patientToken);

    // Fetch email logs to verify registration email was sent in simulator
    console.log('  -> Checking Email Simulator for Verification Link...');
    const emailList = await request({ hostname: 'localhost', port: PORT, path: '/api/dev/emails', method: 'GET' });
    const verifyEmail = emailList.body.find(e => e.to === patientEmail && e.subject.includes('Verify'));
    if (!verifyEmail) throw new Error('Verification email not logged in simulator.');
    console.log('  -> Success: Verification email captured in simulator inbox.');

    // Verify email using token
    console.log('  -> Verifying Patient Email...');
    const verifyPatient = await request({ hostname: 'localhost', port: PORT, path: `/api/auth/verify?token=${patientToken}`, method: 'GET' });
    if (verifyPatient.status !== 200) throw new Error('Verification failed.');
    console.log('  -> Success:', verifyPatient.body.message);

    // Login patient
    console.log('  -> Logging in Patient...');
    const loginPatient = await request({
      hostname: 'localhost', port: PORT, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: patientEmail, password: 'password123' });
    if (loginPatient.status !== 200) throw new Error('Patient login failed.');
    patientId = loginPatient.body.user.id;
    console.log('  -> Success: Patient logged in. ID:', patientId);

    // -----------------------------------------------------------------
    // STEP 2: ONBOARD PHYSIOTHERAPIST
    // -----------------------------------------------------------------
    console.log('\n[Step 2] Registering Physiotherapist...');
    const regPhysio = await request({
      hostname: 'localhost', port: PORT, path: '/api/auth/signup', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      role: 'physiotherapist', name: 'Dr. Sarah Therapist', email: therapistEmail, password: 'password123',
      contactNumber: '+1 555-200-3000', qualification: 'DPT, MSc', specialization: 'Sports Rehab',
      clinicAddress: '404 Spine Way', fees: 100
    });
    if (regPhysio.status !== 201) throw new Error('Therapist registration failed.');
    const physioToken = regPhysio.body.user.verificationToken;

    // Verify therapist
    console.log('  -> Verifying Therapist Email...');
    await request({ hostname: 'localhost', port: PORT, path: `/api/auth/verify?token=${physioToken}`, method: 'GET' });

    // Login therapist
    console.log('  -> Logging in Therapist...');
    const loginPhysio = await request({
      hostname: 'localhost', port: PORT, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: therapistEmail, password: 'password123' });
    therapistId = loginPhysio.body.user.id;
    console.log('  -> Success: Therapist logged in. ID:', therapistId);

    // -----------------------------------------------------------------
    // STEP 3: THERAPIST CONFIGURES SCHEDULE
    // -----------------------------------------------------------------
    console.log('\n[Step 3] Therapist configuring schedule slots & fees...');
    const setupSched = await request({
      hostname: 'localhost', port: PORT, path: '/api/physio/schedule/update', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': therapistId }
    }, {
      slots: ['09:00 AM', '10:00 AM', '11:00 AM'],
      daysOff: ['2026-06-25'], // Example day off
      fees: 130 // Update fee
    });
    if (setupSched.status !== 200) throw new Error(`Schedule update failed: ${JSON.stringify(setupSched.body)}`);
    console.log('  -> Success:', setupSched.body.message);

    // Get Raw Schedule Info
    console.log('  -> Checking raw settings retrieval...');
    const getRaw = await request({ hostname: 'localhost', port: PORT, path: `/api/physiotherapists/${therapistId}/schedule?date=none`, method: 'GET' });
    if (getRaw.body.fees !== 130 || getRaw.body.slots.length !== 3) throw new Error('Schedule mismatch.');
    console.log('  -> Success: Schedule values matches configuration.');

    // -----------------------------------------------------------------
    // STEP 4: PATIENT VIEWS SCHEDULE & BOOK SLOT (With payment check)
    // -----------------------------------------------------------------
    console.log('\n[Step 4] Patient browsing therapist schedule...');
    const getAvailability = await request({ hostname: 'localhost', port: PORT, path: `/api/physiotherapists/${therapistId}/schedule?date=${testDate}`, method: 'GET' });
    if (getAvailability.body.slots.length !== 3) throw new Error('Incorrect slots availability.');
    console.log('  -> Success: Available slots for date:', getAvailability.body.slots.map(s => s.time).join(', '));

    // Book Slot 1 (09:00 AM)
    console.log('  -> Booking Slot 1 (09:00 AM) with mock checkout...');
    const bookSlot1 = await request({
      hostname: 'localhost', port: PORT, path: '/api/appointments/book', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': patientId }
    }, {
      physioId: therapistId, date: testDate, timeSlot: '09:00 AM',
      paymentDetails: { cardNumber: '4111222233334444', expiryDate: '12/28', cvv: '123' }
    });
    if (bookSlot1.status !== 201) throw new Error(`Booking 1 failed: ${JSON.stringify(bookSlot1.body)}`);
    appointmentId1 = bookSlot1.body.booking.id;
    console.log('  -> Success: Appointment 1 booked. ID:', appointmentId1);

    // Verify slot is now marked as booked
    const getAvailability2 = await request({ hostname: 'localhost', port: PORT, path: `/api/physiotherapists/${therapistId}/schedule?date=${testDate}`, method: 'GET' });
    const slot09 = getAvailability2.body.slots.find(s => s.time === '09:00 AM');
    if (!slot09.booked) throw new Error('Slot 09:00 AM should be marked as booked.');
    console.log('  -> Success: Slot 09:00 AM is correctly flagged as booked.');

    // Book Slot 2 (10:00 AM)
    console.log('  -> Booking Slot 2 (10:00 AM) for sequence reorder testing...');
    const bookSlot2 = await request({
      hostname: 'localhost', port: PORT, path: '/api/appointments/book', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': patientId }
    }, {
      physioId: therapistId, date: testDate, timeSlot: '10:00 AM',
      paymentDetails: { cardNumber: '4111222233334444', expiryDate: '12/28', cvv: '123' }
    });
    appointmentId2 = bookSlot2.body.booking.id;
    console.log('  -> Success: Appointment 2 booked. ID:', appointmentId2);

    // Verify confirmation emails sent
    const emailList2 = await request({ hostname: 'localhost', port: PORT, path: '/api/dev/emails', method: 'GET' });
    const confirmationReceipts = emailList2.body.filter(e => e.subject.includes('Confirmed') && e.to === patientEmail);
    if (confirmationReceipts.length !== 2) throw new Error('Receipts not logged in simulator drawer.');
    console.log(`  -> Success: Email Simulator drawer has ${confirmationReceipts.length} confirmation receipts.`);

    // -----------------------------------------------------------------
    // STEP 5: THERAPIST TIMELINE VIEW & REORDER SEQUENCE
    // -----------------------------------------------------------------
    console.log('\n[Step 5] Therapist loading daily appointment timeline...');
    const getTimeline = await request({
      hostname: 'localhost', port: PORT, path: `/api/physio/appointments?date=${testDate}`, method: 'GET',
      headers: { 'x-user-id': therapistId }
    });
    console.log('  -> Initial Sequence order:');
    getTimeline.body.forEach((a, i) => console.log(`     [Index ${i}] ID: ${a.id} | Slot: ${a.timeSlot} | Name: ${a.patientName}`));
    
    if (getTimeline.body[0].id !== appointmentId1 || getTimeline.body[1].id !== appointmentId2) {
      throw new Error('Initial order is incorrect.');
    }

    // Reorder sequence: swap Appointment 1 and Appointment 2
    console.log('  -> Reordering sequence (Swap 1 & 2)...');
    const reorder = await request({
      hostname: 'localhost', port: PORT, path: '/api/physio/appointments/reorder', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': therapistId }
    }, {
      date: testDate,
      appointmentIdsOrder: [appointmentId2, appointmentId1]
    });
    if (reorder.status !== 200) throw new Error('Reorder request failed.');
    
    console.log('  -> Updated Sequence order:');
    reorder.body.appointments.forEach((a, i) => console.log(`     [Index ${i}] ID: ${a.id} | Slot: ${a.timeSlot} | Name: ${a.patientName}`));

    if (reorder.body.appointments[0].id !== appointmentId2 || reorder.body.appointments[1].id !== appointmentId1) {
      throw new Error('Appointments failed to reorder in sequence.');
    }
    console.log('  -> Success: Sequence indices successfully updated in database.');

    console.log('\n========================================================');
    console.log('      INTEGRATION TESTS PASSED - SYSTEM IS 100% HEALTHY ');
    console.log('========================================================');
  } catch (error) {
    console.error('\nFAIL: Integration test encountered error:', error.message);
    process.exit(1);
  }
}

runIntegrationTest();
