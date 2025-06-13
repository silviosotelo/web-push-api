const db = require('../config/database');
const logger = require('../utils/logger');

class MobilePushService {
  constructor() {
    // Inicialización del servicio
  }

  // Registrar dispositivo (equivalente a registrarTokenAlt)
  async registerDevice(deviceData) {
    return new Promise((resolve, reject) => {
      const {
        device_token,
        uid,
        uuid,
        platform,
        user_id,
        device_name,
        app_version,
        status = 'active'
      } = deviceData;

      const sql = `
        INSERT OR REPLACE INTO devices 
        (device_token, uid, uuid, platform, user_id, device_name, app_version, status, last_seen) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      db.run(sql, [device_token, uid, uuid, platform, user_id, device_name, app_version, status], function(err) {
        if (err) {
          logger.error('Error registering device:', err);
          reject(err);
          return;
        }
        
        logger.info(`Device registered successfully: ${device_token}`);
        resolve({
          success: true,
          device_id: this.lastID,
          device_token
        });
      });
    });
  }

  // Obtener notificaciones pendientes
  async getPendingNotifications(userId, deviceToken) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          id,
          title,
          body,
          data,
          notification_type,
          priority,
          created_at,
          sender_id
        FROM notifications 
        WHERE (target_user_id = ? OR device_token = ?) 
          AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 50
      `;

      db.all(sql, [userId, deviceToken], (err, rows) => {
        if (err) {
          logger.error('Error fetching pending notifications:', err);
          reject(err);
          return;
        }

        // Procesar datos JSON
        const notifications = rows.map(row => ({
          ...row,
          data: row.data ? JSON.parse(row.data) : {}
        }));

        resolve(notifications);
      });
    });
  }

  // Enviar notificación (crear notificación para polling)
  async sendNotification(notificationData) {
    return new Promise((resolve, reject) => {
      const {
        title,
        body,
        target_user_id,
        sender_id,
        data = {},
        priority = 'normal',
        notification_type = 'custom',
        target_token
      } = notificationData;

      const sql = `
        INSERT INTO notifications 
        (device_token, target_user_id, sender_id, title, body, data, priority, notification_type, status, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
      `;

      const dataJson = JSON.stringify(data);

      db.run(sql, [target_token, target_user_id, sender_id, title, body, dataJson, priority, notification_type], function(err) {
        if (err) {
          logger.error('Error creating notification:', err);
          reject(err);
          return;
        }

        const notificationId = this.lastID;

        // Registrar en el historial
        this.logNotificationHistory(notificationId, target_token, 'created', 'Notification created successfully');

        logger.info(`Notification created with ID: ${notificationId}`);
        resolve({
          success: true,
          notification_id: notificationId,
          message: 'Notification created successfully'
        });
      }.bind(this));
    });
  }

  // Marcar notificación como leída
  async markNotificationAsRead(notificationId, userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE notifications 
        SET status = 'read', read_at = CURRENT_TIMESTAMP 
        WHERE id = ? AND target_user_id = ?
      `;

      db.run(sql, [notificationId, userId], function(err) {
        if (err) {
          logger.error('Error marking notification as read:', err);
          reject(err);
          return;
        }

        if (this.changes === 0) {
          reject(new Error('Notification not found or not authorized'));
          return;
        }

        // Registrar en el historial
        this.logNotificationHistory(notificationId, null, 'read', 'Notification marked as read');

        logger.info(`Notification ${notificationId} marked as read`);
        resolve({
          success: true,
          message: 'Notification marked as read'
        });
      }.bind(this));
    });
  }

  // Obtener historial de notificaciones
  async getNotificationHistory(userId, limit = 50) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          n.id,
          n.title,
          n.body,
          n.data,
          n.notification_type,
          n.priority,
          n.status,
          n.created_at,
          n.sent_at,
          n.read_at,
          n.sender_id,
          d.device_name,
          d.platform
        FROM notifications n
        LEFT JOIN devices d ON n.device_token = d.device_token
        WHERE n.target_user_id = ?
        ORDER BY n.created_at DESC
        LIMIT ?
      `;

      db.all(sql, [userId, limit], (err, rows) => {
        if (err) {
          logger.error('Error fetching notification history:', err);
          reject(err);
          return;
        }

        // Procesar datos JSON
        const notifications = rows.map(row => ({
          ...row,
          data: row.data ? JSON.parse(row.data) : {}
        }));

        resolve(notifications);
      });
    });
  }

  // Actualizar última conexión del dispositivo
  async updateDeviceLastSeen(deviceToken) {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE devices SET last_seen = CURRENT_TIMESTAMP WHERE device_token = ?`;

      db.run(sql, [deviceToken], function(err) {
        if (err) {
          logger.error('Error updating device last seen:', err);
          reject(err);
          return;
        }
        resolve({ success: true });
      });
    });
  }

  // Obtener dispositivos de un usuario
  async getUserDevices(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          device_token,
          device_name,
          platform,
          app_version,
          status,
          last_seen,
          created_at
        FROM devices 
        WHERE user_id = ? AND status = 'active'
        ORDER BY last_seen DESC
      `;

      db.all(sql, [userId], (err, rows) => {
        if (err) {
          logger.error('Error fetching user devices:', err);
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  // Registrar evento en historial
  logNotificationHistory(notificationId, deviceToken, action, details) {
    const sql = `
      INSERT INTO notification_history 
      (notification_id, device_token, action, details, timestamp) 
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    db.run(sql, [notificationId, deviceToken, action, details], (err) => {
      if (err) {
        logger.error('Error logging notification history:', err);
      }
    });
  }

  // Limpiar notificaciones antiguas (ejecutar periódicamente)
  async cleanupOldNotifications(daysOld = 30) {
    return new Promise((resolve, reject) => {
      const sql = `
        DELETE FROM notifications 
        WHERE created_at < datetime('now', '-${daysOld} days')
          AND status IN ('read', 'failed')
      `;

      db.run(sql, [], function(err) {
        if (err) {
          logger.error('Error cleaning up old notifications:', err);
          reject(err);
          return;
        }

        logger.info(`Cleaned up ${this.changes} old notifications`);
        resolve({ deleted: this.changes });
      });
    });
  }

  // Estadísticas de notificaciones
  async getNotificationStats(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM notifications 
        WHERE target_user_id = ?
          AND created_at >= datetime('now', '-7 days')
      `;

      db.get(sql, [userId], (err, row) => {
        if (err) {
          logger.error('Error fetching notification stats:', err);
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }
}

module.exports = new MobilePushService();