const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, 'database.json');

// Simple queue to serialize read/write operations and prevent race conditions
class AsyncQueue {
  constructor() {
    this.queue = Promise.resolve();
  }

  enqueue(operation) {
    const nextPromise = this.queue.then(async () => {
      try {
        return await operation();
      } catch (err) {
        console.error('Database operation failed:', err);
        throw err;
      }
    });
    // Ensure the queue chain recovers and resolves for the next operation
    this.queue = nextPromise.catch(() => {});
    return nextPromise;
  }
}

const dbQueue = new AsyncQueue();

// Password utility functions
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Ensure database file exists
async function ensureDbExists() {
  try {
    await fs.access(DB_FILE);
  } catch (err) {
    // If database.json doesn't exist, create it with pre-populated verified physiotherapists
    const initialDb = {
      users: [
        {
          id: "physio-sarah",
          role: "physiotherapist",
          name: "Sarah Jenkins",
          email: "sarah.jenkins@physioconnect.com",
          password: hashPassword("password123"),
          contactNumber: "+1 (555) 019-2834",
          qualification: "DPT, MSc Sports Physio",
          specialization: "Sports Rehabilitation",
          clinicAddress: "Sports Care Clinic, Suite 100, West Medical Blvd",
          fees: 120,
          isVerified: true,
          verificationToken: null,
          createdAt: new Date().toISOString()
        },
        {
          id: "physio-marcus",
          role: "physiotherapist",
          name: "Marcus Vance",
          email: "marcus.vance@physioconnect.com",
          password: hashPassword("password123"),
          contactNumber: "+1 (555) 042-8812",
          qualification: "B.Physio, Cert. Spinal Manual Therapy",
          specialization: "Orthopedics & Spinal Care",
          clinicAddress: "Spine & Joint Institute, 505 Spine Ave",
          fees: 150,
          isVerified: true,
          verificationToken: null,
          createdAt: new Date().toISOString()
        },
        {
          id: "physio-elena",
          role: "physiotherapist",
          name: "Elena Rostova",
          email: "elena.rostova@physioconnect.com",
          password: hashPassword("password123"),
          contactNumber: "+1 (555) 091-7764",
          qualification: "DPT, PhD Pediatric Rehab",
          specialization: "Pediatric Physiotherapy",
          clinicAddress: "Kids Rehab Center, 12 Care Lane",
          fees: 110,
          isVerified: true,
          verificationToken: null,
          createdAt: new Date().toISOString()
        }
      ],
      schedules: [
        {
          physioId: "physio-sarah",
          slots: ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM"],
          daysOff: [],
          fees: 120
        },
        {
          physioId: "physio-marcus",
          slots: ["09:30 AM", "10:30 AM", "11:30 AM", "01:30 PM", "02:30 PM", "03:30 PM"],
          daysOff: [],
          fees: 150
        },
        {
          physioId: "physio-elena",
          slots: ["08:00 AM", "10:00 AM", "12:00 PM", "02:00 PM", "04:00 PM"],
          daysOff: [],
          fees: 110
        }
      ],
      appointments: [],
      emails: []
    };
    await fs.writeFile(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf8');
  }
}

// Low-level read (should be run within queue lock)
async function rawRead() {
  await ensureDbExists();
  const dataStr = await fs.readFile(DB_FILE, 'utf8');
  try {
    return JSON.parse(dataStr);
  } catch (e) {
    console.error('Error parsing JSON db, resetting to default:', e);
    return { users: [], schedules: [], appointments: [], emails: [] };
  }
}

// Low-level write (should be run within queue lock)
async function rawWrite(data) {
  const tempFile = DB_FILE + '.tmp';
  await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
  try {
    try {
      await fs.unlink(DB_FILE);
    } catch (_) {}
    await fs.rename(tempFile, DB_FILE);
  } catch (e) {
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    try {
      await fs.unlink(tempFile);
    } catch (_) {}
  }
}

module.exports = {
  dbQueue,
  rawRead,
  rawWrite,
  hashPassword
};
