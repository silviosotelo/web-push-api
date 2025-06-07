const webpush = require('web-push');
const db = require('../config/database');
const logger = require('../utils/logger');

class PushService {
  constructor() {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }

  async saveSubscription(subscription) {
    return new Promise((resolve, reject) => {
      const { endpoint, keys: { auth, p256dh } } = subscription;
      
      const sql = `INSERT INTO subscriptions (endpoint, auth, p256dh) VALUES (?, ?, ?)`;
      
      db.run(sql, [endpoint, auth, p256dh], function(err) {
        if (err) {
          logger.error('Error saving subscription:', err);
          reject(err);
          return;
        }
        logger.info(`Saved subscription with ID: ${this.lastID}`);
        resolve(this.lastID);
      });
    });
  }

  async sendNotification(subscriptionId, payload) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM subscriptions WHERE id = ?',
        [subscriptionId],
        async (err, subscription) => {
          if (err) {
            logger.error('Error fetching subscription:', err);
            reject(err);
            return;
          }

          if (!subscription) {
            logger.error(`Subscription not found: ${subscriptionId}`);
            reject(new Error('Subscription not found'));
            return;
          }

          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              auth: subscription.auth,
              p256dh: subscription.p256dh
            }
          };

          try {
            await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
            
            // Log successful notification
            db.run(
              `INSERT INTO notifications (subscription_id, title, body, status) 
               VALUES (?, ?, ?, ?)`,
              [subscriptionId, payload.title, payload.body, 'SUCCESS']
            );

            logger.info(`Notification sent successfully to subscription ${subscriptionId}`);
            resolve();
          } catch (error) {
            // Log failed notification
            db.run(
              `INSERT INTO notifications (subscription_id, title, body, status, error) 
               VALUES (?, ?, ?, ?, ?)`,
              [subscriptionId, payload.title, payload.body, 'FAILED', error.message]
            );

            logger.error('Error sending notification:', error);
            reject(error);
          }
        }
      );
    });
  }

  async getNotificationHistory(limit = 100) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT n.*, s.endpoint 
        FROM notifications n 
        JOIN subscriptions s ON n.subscription_id = s.id 
        ORDER BY n.sent_at DESC 
        LIMIT ?
      `;
      
      db.all(sql, [limit], (err, rows) => {
        if (err) {
          logger.error('Error fetching notification history:', err);
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }
}

module.exports = new PushService();