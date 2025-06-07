require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');
const pushRoutes = require('./routes/pushRoutes');

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', pushRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    status: 'error', 
    message: 'Internal server error' 
  });
});

// Start server
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});