require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');

// Importar rutas
const mobileRoutes = require('./routes/mobileRoutes');
const pushRoutes = require('./routes/pushRoutes'); // Mantener rutas web push por compatibilidad

const app = express();
const port = process.env.PORT || 9500;

// Middleware
app.use(cors({
  origin: '*', // En producción, especificar dominios específicos
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para logging de requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Rutas principales para dispositivos móviles
app.use('/api', mobileRoutes);

// Mantener rutas web push por compatibilidad (si las necesitas)
app.use('/api/web-push', pushRoutes);

// Health check endpoint principal
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'Mobile Push Notification Service',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Endpoint de información del servicio
app.get('/api/info', (req, res) => {
  res.json({
    service: 'Mobile Push Notification Service',
    version: '2.0.0',
    description: 'Custom push notification service for mobile devices',
    endpoints: {
      register_device: 'POST /api/usuarios/registrarTokenAlt',
      pending_notifications: 'GET /api/notificaciones/pendientes',
      send_notification: 'POST /api/notificaciones/enviar',
      notification_history: 'GET /api/notificaciones/historial',
      mark_as_read: 'POST /api/notificaciones/marcar-leida',
      user_devices: 'GET /api/usuarios/:userId/dispositivos',
      statistics: 'GET /api/notificaciones/estadisticas',
      cleanup: 'POST /api/notificaciones/limpiar',
      health: 'GET /api/notificaciones/health'
    },
    timestamp: new Date().toISOString()
  });
});

// Middleware para manejar rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found',
    requested_path: req.originalUrl,
    available_endpoints: '/api/info'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  res.status(500).json({ 
    status: 'error', 
    message: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const server = app.listen(port, '0.0.0.0', () => {
  logger.info(`🚀 Mobile Push Notification Service running on port ${port}`);
  logger.info(`📱 Service URL: http://localhost:${port}`);
  logger.info(`📋 API Info: http://localhost:${port}/api/info`);
  logger.info(`💓 Health Check: http://localhost:${port}/health`);
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${port} is already in use`);
    process.exit(1);
  } else {
    logger.error('Server error:', err);
  }
});

module.exports = app;