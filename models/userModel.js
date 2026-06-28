const crypto = require('crypto');
const db = require('../database');

function verifyPassword(password, storedPassword) {
  const [salt, originalHash] = storedPassword.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

module.exports = {
  // Get all users
  getUsers: () => db.dbQueue.enqueue(async () => {
    const data = await db.rawRead();
    return data.users;
  }),

  // Find user by email
  findUserByEmail: (email) => db.dbQueue.enqueue(async () => {
    const data = await db.rawRead();
    return data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }),

  // Create a new user (patient or physiotherapist)
  createUser: (userData) => db.dbQueue.enqueue(async () => {
    const data = await db.rawRead();
    
    // Check if user already exists
    const exists = data.users.some(u => u.email.toLowerCase() === userData.email.toLowerCase());
    if (exists) {
      throw new Error('An account with this email already exists.');
    }

    const newUser = {
      id: crypto.randomUUID(),
      ...userData,
      password: db.hashPassword(userData.password),
      isVerified: false,
      verificationToken: crypto.randomBytes(32).toString('hex'),
      createdAt: new Date().toISOString()
    };

    data.users.push(newUser);
    await db.rawWrite(data);

    // Return user without password
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }),

  // Verify email by token
  verifyEmail: (token) => db.dbQueue.enqueue(async () => {
    const data = await db.rawRead();
    const user = data.users.find(u => u.verificationToken === token);
    if (!user) {
      throw new Error('Invalid or expired email verification token.');
    }
    user.isVerified = true;
    user.verificationToken = null;
    await db.rawWrite(data);
    return user;
  }),

  // Verify credentials for login
  loginUser: (email, password) => db.dbQueue.enqueue(async () => {
    const data = await db.rawRead();
    const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new Error('Invalid email or password.');
    }
    if (!verifyPassword(password, user.password)) {
      throw new Error('Invalid email or password.');
    }
    if (!user.isVerified) {
      throw new Error('Please verify your email before logging in.');
    }
    
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }),

  // List all physiotherapists
  getPhysiotherapists: () => db.dbQueue.enqueue(async () => {
    const data = await db.rawRead();
    return data.users
      .filter(u => u.role === 'physiotherapist')
      .map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        qualification: u.qualification,
        specialization: u.specialization,
        clinicAddress: u.clinicAddress,
        fees: Number(u.fees) || 0,
        contactNumber: u.contactNumber
      }));
  })
};
