const express = require('express');
const router = express.Router();
const pushService = require('../services/pushService');
const { 
  subscriptionValidationRules, 
  notificationValidationRules, 
  validate 
} = require('../middleware/validators');
const logger = require('../utils/logger');

// Save new subscription
router.post(
  '/subscriptions', 
  subscriptionValidationRules,
  validate,
  async (req, res) => {
    try {
      const subscriptionId = await pushService.saveSubscription(req.body);
      res.status(201).json({ 
        status: 'success', 
        message: 'Subscription saved successfully',
        subscriptionId 
      });
    } catch (error) {
      logger.error('Error in save subscription route:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'Error saving subscription' 
      });
    }
  }
);

// Send notification
router.post(
  '/notifications',
  notificationValidationRules,
  validate,
  async (req, res) => {
    try {
      const subscription = req.body.subscription[0];
      const payload = req.body.payload[0];
      
      // Primero guardamos la suscripción si no existe
      const subscriptionId = await pushService.saveSubscription(subscription);
      
      // Luego enviamos la notificación
      await pushService.sendNotification(subscriptionId, payload);
      
      res.json({ 
        status: 'success', 
        message: 'Notification sent successfully' 
      });
    } catch (error) {
      logger.error('Error in send notification route:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'Error sending notification',
        error: error.message 
      });
    }
  }
);

// Get notification history
router.get('/notifications', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const history = await pushService.getNotificationHistory(limit);
    res.json({ 
      status: 'success', 
      data: history 
    });
  } catch (error) {
    logger.error('Error in get notification history route:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Error fetching notification history' 
    });
  }
});

module.exports = router;