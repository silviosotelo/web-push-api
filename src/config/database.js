const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

const dbPath = path.resolve(__dirname, '../../data/notifications.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error('Error connecting to database:', err);
    process.exit(1);
  }
  logger.info('Connected to SQLite database');
});

// Initialize database tables para dispositivos móviles
const initDatabase = () => {
  // Tabla para dispositivos registrados (reemplaza subscriptions)
  const devicesTable = `
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_token TEXT UNIQUE NOT NULL,
      uid TEXT,
      uuid TEXT NOT NULL,
      platform TEXT NOT NULL,
      user_id TEXT,
      device_name TEXT,
      app_version TEXT,
      status TEXT DEFAULT 'active',
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Tabla para notificaciones (adaptada para móviles)
  const notificationsTable = `
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_token TEXT,
      target_user_id TEXT,
      sender_id TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data TEXT, -- JSON data
      priority TEXT DEFAULT 'normal',
      notification_type TEXT DEFAULT 'custom',
      status TEXT DEFAULT 'pending', -- pending, sent, read, failed
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME,
      read_at DATETIME,
      FOREIGN KEY (device_token) REFERENCES devices(device_token)
    )
  `;

  // Tabla para historial de notificaciones
  const notificationHistoryTable = `
    CREATE TABLE IF NOT EXISTS notification_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_id INTEGER,
      device_token TEXT,
      action TEXT, -- created, sent, delivered, read, failed
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      details TEXT,
      FOREIGN KEY (notification_id) REFERENCES notifications(id)
    )
  `;

  // Índices para optimización
  const createIndexes = [
    `CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_devices_token ON devices(device_token)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(target_user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_history_notification ON notification_history(notification_id)`
  ];

  db.serialize(() => {
    db.run(devicesTable);
    db.run(notificationsTable);
    db.run(notificationHistoryTable);
    
    // Crear índices
    createIndexes.forEach(indexSql => {
      db.run(indexSql);
    });
    
    logger.info('Database tables and indexes created successfully');
  });
};

initDatabase();

module.exports = db;