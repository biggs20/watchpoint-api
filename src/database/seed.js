const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const seed = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Seeding database...');
    
    // Hash the test password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash('testpass123', saltRounds);
    
    // Check if test user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      ['test@watchpoint.io']
    );
    
    if (existingUser.rows.length > 0) {
      console.log('⚠️  Test user already exists, updating...');
      await client.query(`
        UPDATE users 
        SET password_hash = $1, 
            plan_tier = 'pro', 
            watches_limit = 50,
            updated_at = NOW()
        WHERE email = $2
      `, [passwordHash, 'test@watchpoint.io']);
    } else {
      console.log('Creating test user...');
      await client.query(`
        INSERT INTO users (email, password_hash, name, plan_tier, watches_limit, email_verified)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, ['test@watchpoint.io', passwordHash, 'Test User', 'pro', 50, true]);
    }
    
    console.log('✅ Seed completed successfully!');
    console.log('Test user created:');
    console.log('  Email: test@watchpoint.io');
    console.log('  Password: testpass123');
    console.log('  Plan: pro (50 watches limit)');
    
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
