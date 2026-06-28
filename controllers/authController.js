const userModel = require('../models/userModel');
const emailModel = require('../models/emailModel');

const PORT = process.env.PORT || 3000;

module.exports = {
  // Sign Up
  signup: async (req, res) => {
    try {
      const { role, email, password, name, contactNumber } = req.body;

      if (!email || !password || !name || !role || !contactNumber) {
        return res.status(400).json({ error: 'Please fill in all required profile fields.' });
      }

      if (role !== 'user' && role !== 'physiotherapist') {
        return res.status(400).json({ error: 'Invalid user role selected.' });
      }

      let profileData = { role, email, password, name, contactNumber };

      if (role === 'user') {
        const { age, gender } = req.body;
        if (!age || !gender) {
          return res.status(400).json({ error: 'Please fill in patient Age and Gender.' });
        }
        profileData.age = Number(age);
        profileData.gender = gender;
      } else {
        const { qualification, specialization, clinicAddress, fees } = req.body;
        if (!qualification || !specialization || !clinicAddress || fees === undefined) {
          return res.status(400).json({ error: 'Please fill in therapist qualification, specialization, clinic address, and fees.' });
        }
        profileData.qualification = qualification;
        profileData.specialization = specialization;
        profileData.clinicAddress = clinicAddress;
        profileData.fees = Number(fees) || 0;
      }

      const newUser = await userModel.createUser(profileData);

      // Generate simulated verification email
      const origin = req.headers.origin || `http://localhost:${PORT}`;
      const verificationLink = `${origin}/#login?verifyToken=${newUser.verificationToken}`;
      
      const subject = 'Verify your Physiotherapy Appointment System Account';
      const textBody = `Hello ${newUser.name},\n\nPlease verify your account by clicking this link: ${verificationLink}`;
      const htmlBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0d9488; margin-top: 0;">Welcome to Physiotherapy Appointment System!</h2>
          <p>Thank you for signing up. Please click the button below to verify your email address and activate your account:</p>
          <div style="margin: 24px 0; text-align: center;">
            <a href="${verificationLink}" style="background-color: #0d9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Account</a>
          </div>
          <p style="color: #64748b; font-size: 0.875rem;">If the button doesn't work, copy and paste the link below into your browser:</p>
          <p style="word-break: break-all; color: #0d9488; font-size: 0.875rem;">${verificationLink}</p>
        </div>
      `;

      await emailModel.logEmail(newUser.email, subject, textBody, htmlBody);

      res.status(201).json({
        message: 'Registration successful! A verification email has been simulated. Please click the verification link in the Email Simulator panel at the bottom of the screen to activate your account.',
        user: newUser
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Verify Email
  verify: async (req, res) => {
    try {
      const { token } = req.query;
      if (!token) {
        return res.status(400).json({ error: 'Verification token is required.' });
      }
      const verifiedUser = await userModel.verifyEmail(token);
      res.json({ message: `Account for ${verifiedUser.name} successfully verified! You can now log in.` });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Login
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const authenticatedUser = await userModel.loginUser(email, password);
      res.json({
        message: 'Sign-in successful!',
        user: authenticatedUser
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
};
