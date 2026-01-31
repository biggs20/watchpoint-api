const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const createTables = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database migration...');
    
    // Begin transaction
    await client.query('BEGIN');

    // TABLE: users
    console.log('Creating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        phone VARCHAR(50),
        phone_verified BOOLEAN DEFAULT FALSE,
        plan_tier VARCHAR(50) DEFAULT 'free',
        watches_limit INTEGER DEFAULT 5,
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        email_verified BOOLEAN DEFAULT FALSE,
        email_digest_enabled BOOLEAN DEFAULT TRUE,
        timezone VARCHAR(100) DEFAULT 'America/New_York',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // TABLE: watches
    console.log('Creating watches table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS watches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        url TEXT NOT NULL,
        watch_type VARCHAR(50) NOT NULL,
        selector TEXT,
        auth_required BOOLEAN DEFAULT FALSE,
        auth_login_url TEXT,
        auth_username_encrypted TEXT,
        auth_password_encrypted TEXT,
        auth_steps JSONB,
        check_frequency VARCHAR(50) NOT NULL,
        alert_email BOOLEAN DEFAULT TRUE,
        alert_sms BOOLEAN DEFAULT FALSE,
        alert_webhook BOOLEAN DEFAULT FALSE,
        webhook_url TEXT,
        status VARCHAR(50) DEFAULT 'active',
        name VARCHAR(255),
        notes TEXT,
        noise_patterns JSONB DEFAULT '[]'::jsonb,
        sensitivity VARCHAR(50) DEFAULT 'normal',
        last_checked_at TIMESTAMP,
        next_check_at TIMESTAMP,
        consecutive_errors INTEGER DEFAULT 0,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // TABLE: snapshots
    console.log('Creating snapshots table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        watch_id UUID REFERENCES watches(id) ON DELETE CASCADE NOT NULL,
        content_hash VARCHAR(64) NOT NULL,
        content_text TEXT,
        metadata JSONB,
        captured_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // TABLE: changes
    console.log('Creating changes table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS changes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        watch_id UUID REFERENCES watches(id) ON DELETE CASCADE NOT NULL,
        snapshot_before_id UUID REFERENCES snapshots(id),
        snapshot_after_id UUID REFERENCES snapshots(id),
        change_type VARCHAR(50) NOT NULL,
        severity VARCHAR(50) NOT NULL,
        summary TEXT NOT NULL,
        diff_data JSONB,
        notified_at TIMESTAMP,
        notification_status VARCHAR(50) DEFAULT 'pending',
        user_feedback VARCHAR(50),
        detected_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // TABLE: notifications
    console.log('Creating notifications table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) NOT NULL,
        change_id UUID REFERENCES changes(id),
        channel VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        recipient TEXT NOT NULL,
        subject TEXT,
        body TEXT,
        sent_at TIMESTAMP,
        opened_at TIMESTAMP,
        clicked_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    console.log('Creating indexes...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_watches_next_check 
      ON watches(next_check_at) 
      WHERE status = 'active'
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_watches_user 
      ON watches(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_snapshots_watch 
      ON snapshots(watch_id, captured_at DESC)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_changes_watch 
      ON changes(watch_id, detected_at DESC)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_changes_pending 
      ON changes(notification_status) 
      WHERE notification_status = 'pending'
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user 
      ON notifications(user_id, created_at DESC)
    `);

    // Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ Migration completed successfully!');
    console.log('Tables created: users, watches, snapshots, changes, notifications');
    console.log('Indexes created: 6 indexes for optimized queries');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

createTables()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
