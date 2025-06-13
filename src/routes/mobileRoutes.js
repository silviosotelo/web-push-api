const express = require('express');
const router = express.Router();
const mobilePushService = require('../services/mobilePushService');
const { body, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Middleware para validar errores
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      status: 'error',
      message: 'Validation failed',
      errors: errors.array() 
    });
  }
  next();
};

// 1. Registrar dispositivo - POST /usuarios/registrarTokenAlt
router.post('/usuarios/registrarTokenAlt', [
  body('device_token').notEmpty().withMessage('Device token is required'),
  body('uuid').notEmpty().withMessage('UUID is required'),
  body('platform').isIn(['android', 'ios', 'web']).withMessage('Invalid platform'),
  body('user_id').notEmpty().withMessage('User ID is required')
], validate, async (req, res) => {
  try {
    const deviceData = {
      device_token: req.body.device_token,
      uid: req.body.uid,
      uuid: req.body.uuid,
      platform: req.body.platform,
      user_id: req.body.user_id,
      device_name: req.body.device_name || 'Unknown Device',
      app_version: req.body.app_version || '1.0.0',
      status: req.body.status || 'active'
    };

    const result = await mobilePushService.registerDevice(deviceData);
    
    res.status(200).json({
      status: 'success',
      message: 'Device registered successfully',
      data: result
    });

  } catch (error) {
    logger.error('Error in register device route:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error registering device',
      error: error.message
    });
  }
});

// 2. Obtener notificaciones pendientes - GET /notificaciones/pendientes
router.get('/notificaciones/pendientes', [
  query('user_id').notEmpty().withMessage('User ID is required'),
  query('device_token').notEmpty().withMessage('Device token is required')
], validate, async (req, res) => {
  try {
    const userId = req.query.user_id;
    const deviceToken = req.query.device_token;

    // Actualizar última conexión del dispositivo
    await mobilePushService.updateDeviceLastSeen(deviceToken);

    // Obtener notificaciones pendientes
    const notifications = await mobilePushService.getPendingNotifications(userId, deviceToken);
    
    res.status(200).json({
      status: 'success',
      message: 'Pending notifications retrieved',
      data: notifications,
      count: notifications.length
    });

  } catch (error) {
    logger.error('Error in get pending notifications route:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching pending notifications',
      error: error.message
    });
  }
});

// 3. Enviar notificación - POST /notificaciones/enviar
router.post('/notificaciones/enviar', [
  body('title').notEmpty().withMessage('Title is required'),
  body('body').notEmpty().withMessage('Body is required'),
  body('target_user_id').notEmpty().withMessage('Target user ID is required'),
  body('sender_id').notEmpty().withMessage('Sender ID is required')
], validate, async (req, res) => {
  try {
    const notificationData = {
      title: req.body.title,
      body: req.body.body,
      target_user_id: req.body.target_user_id,
      sender_id: req.body.sender_id,
      data: req.body.data || {},
      priority: req.body.priority || 'normal',
      notification_type: req.body.notification_type || 'custom',
      target_token: req.body.target_token
    };

    const result = await mobilePushService.sendNotification(notificationData);
    
    res.status(200).json({
      status: 'success',
      message: 'Notification sent successfully',
      data: result
    });

  } catch (error) {
    logger.error('Error in send notification route:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error sending notification',
      error: error.message
    });
  }
});

// 4. Obtener historial de notificaciones - GET /notificaciones/historial
router.get('/notificaciones/historial', [
  query('user_id').notEmpty().withMessage('User ID is required')
], validate, async (req, res) => {
  try {
    const userId = req.query.user_id;
    const limit = parseInt(req.query.limit) || 50;

    const history = await mobilePushService.getNotificationHistory(userId, limit);
    
    res.status(200).json({
      status: 'success',
      message: 'Notification history retrieved',
      data: history,
      count: history.length
    });

  } catch (error) {
    logger.error('Error in get notification history route:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching notification history',
      error: error.message
    });
  }
});

// 5. Marcar notificación como leída - POST /notificaciones/marcar-leida
router.post('/notificaciones/marcar-leida', [
  body('notification_id').notEmpty().withMessage('Notification ID is required'),
  body('user_id').notEmpty().withMessage('User ID is required')
], validate, async (req, res) => {
  try {
    const notificationId = req.body.notification_id;
    const userId = req.body.user_id;

    const result = await mobilePushService.markNotificationAsRead(notificationId, userId);
    
    res.status(200).json({
      status: 'success',
      message: 'Notification marked as read',
      data: result
    });

  } catch (error) {
    logger.error('Error in mark notification as read route:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error marking notification as read',
      error: error.message
    });
  }
});

// 6. Obtener dispositivos del usuario - GET /usuarios/:userId/dispositivos
router.get('/usuarios/:userId/dispositivos', async (req, res) => {
  try {
    const userId = req.params.userId;
    const devices = await mobilePushService.getUserDevices(userId);
    
    res.status(200).json({
      status: 'success',
      message: 'User devices retrieved',
      data: devices,
      count: devices.length
    });

  } catch (error) {
    logger.error('Error in get user devices route:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching user devices',
      error: error.message
    });
  }
});

// 7. Estadísticas de notificaciones - GET /notificaciones/estadisticas
router.get('/notificaciones/estadisticas', [
  query('user_id').notEmpty().withMessage('User ID is required')
], validate, async (req, res) => {
  try {
    const userId = req.query.user_id;
    const stats = await mobilePushService.getNotificationStats(userId);
    
    res.status(200).json({
      status: 'success',
      message: 'Notification statistics retrieved',
      data: stats
    });

  } catch (error) {
    logger.error('Error in get notification stats route:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching notification statistics',
      error: error.message
    });
  }
});

// 8. Limpiar notificaciones antiguas - POST /notificaciones/limpiar
router.post('/notificaciones/limpiar', [
  body('days_old').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365')
], validate, async (req, res) => {
  try {
    const daysOld = req.body.days_old || 30;
    const result = await mobilePushService.cleanupOldNotifications(daysOld);
    
    res.status(200).json({
      status: 'success',
      message: 'Old notifications cleaned up',
      data: result
    });

  } catch (error) {
    logger.error('Error in cleanup notifications route:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error cleaning up notifications',
      error: error.message
    });
  }
});

// 9. Health check específico para notificaciones móviles
router.get('/notificaciones/health', async (req, res) => {
  try {
    // Verificar conexión a base de datos haciendo una consulta simple
    const stats = await new Promise((resolve, reject) => {
      const db = require('../config/database');
      db.get('SELECT COUNT(*) as count FROM devices WHERE status = "active"', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.status(200).json({
      status: 'healthy',
      message: 'Mobile notification service is running',
      data: {
        active_devices: stats.count,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error in health check:', error);
    res.status(500).json({
      status: 'unhealthy',
      message: 'Mobile notification service has issues',
      error: error.message
    });
  }
});

module.exports = router;