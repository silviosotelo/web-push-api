const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../data/notifications.db');
const backupPath = path.resolve(__dirname, '../data/notifications_backup.db');

console.log('🔄 Starting database migration...');

// Crear backup de la base de datos actual
function createBackup() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dbPath)) {
      try {
        fs.copyFileSync(dbPath, backupPath);
        console.log('✅ Database backup created successfully');
        resolve();
      } catch (error) {
        console.error('❌ Error creating backup:', error);
        reject(error);
      }
    } else {
      console.log('ℹ️ No existing database found, creating new one');
      resolve();
    }
  });
}

// Ejecutar migración
function runMigration() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Error connecting to database:', err);
        reject(err);
        return;
      }
      console.log('✅ Connected to database for migration');
    });

    // Verificar si las tablas nuevas ya existen
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='devices'", (err, row) => {
      if (err) {
        console.error('❌ Error checking existing tables:', err);
        reject(err);
        return;
      }

      if (row) {
        console.log('ℹ️ Migration tables already exist, skipping creation');
        resolve();
        return;
      }

      // Crear las nuevas tablas
      const migrations = [
        // Tabla de dispositivos
        `CREATE TABLE IF NOT EXISTS devices (
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
        )`,

        // Recrear tabla de notificaciones con nuevos campos
        `CREATE TABLE IF NOT EXISTS notifications_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_token TEXT,
          target_user_id TEXT,
          sender_id TEXT,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          data TEXT,
          priority TEXT DEFAULT 'normal',
          notification_type TEXT DEFAULT 'custom',
          status TEXT DEFAULT 'pending',
          error TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          sent_at DATETIME,
          read_at DATETIME,
          FOREIGN KEY (device_token) REFERENCES devices(device_token)
        )`,

        // Tabla de historial
        `CREATE TABLE IF NOT EXISTS notification_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          notification_id INTEGER,
          device_token TEXT,
          action TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          details TEXT,
          FOREIGN KEY (notification_id) REFERENCES notifications_new(id)
        )`,

        // Índices para optimización
        `CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_devices_token ON devices(device_token)`,
        `CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications_new(status)`,
        `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications_new(target_user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications_new(created_at)`,
        `CREATE INDEX IF NOT EXISTS idx_history_notification ON notification_history(notification_id)`
      ];

      db.serialize(() => {
        // Ejecutar migraciones
        migrations.forEach((sql, index) => {
          db.run(sql, (err) => {
            if (err) {
              console.error(`❌ Error in migration ${index + 1}:`, err);
            } else {
              console.log(`✅ Migration ${index + 1} completed`);
            }
          });
        });

        // Migrar datos existentes si existe la tabla notifications
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'", (err, row) => {
          if (row) {
            console.log('🔄 Migrating existing notification data...');
            
            const migrateSql = `
              INSERT INTO notifications_new (title, body, status, error, sent_at, created_at)
              SELECT title, body, status, error, sent_at, created_at
              FROM notifications
            `;

            db.run(migrateSql, (err) => {
              if (err) {
                console.error('❌ Error migrating data:', err);
              } else {
                console.log('✅ Data migration completed');
                
                // Renombrar tablas
                db.run('DROP TABLE IF EXISTS notifications_old', () => {
                  db.run('ALTER TABLE notifications RENAME TO notifications_old', () => {
                    db.run('ALTER TABLE notifications_new RENAME TO notifications', () => {
                      console.log('✅ Table renaming completed');
                      resolve();
                    });
                  });
                });
              }
            });
          } else {
            // Renombrar tabla nueva
            db.run('ALTER TABLE notifications_new RENAME TO notifications', () => {
              console.log('✅ New table setup completed');
              resolve();
            });
          }
        });
      });
    });
  });
}

// Ejecutar migración completa
async function migrate() {
  try {
    await createBackup();
    await runMigration();
    console.log('🎉 Migration completed successfully!');
    console.log(`📋 Backup saved at: ${backupPath}`);
    process.exit(0);
  } catch (error) {
    console.error('💥 Migration failed:', error);
    console.log('🔄 Restoring from backup...');
    
    if (fs.existsSync(backupPath)) {
      try {
        fs.copyFileSync(backupPath, dbPath);
        console.log('✅ Database restored from backup');
      } catch (restoreError) {
        console.error('❌ Error restoring backup:', restoreError);
      }
    }
    
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  migrate();
}

module.exports = { migrate };