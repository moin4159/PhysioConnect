const express = require('express');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const physioRoutes = require('./routes/physioRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const devRoutes = require('./routes/devRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routers mapping
app.use('/api/auth', authRoutes);
app.use('/api/physiotherapists', physioRoutes);
app.use('/api', appointmentRoutes);
app.use('/api/dev', devRoutes);

// Fallback index.html router for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
