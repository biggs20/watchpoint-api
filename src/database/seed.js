const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function seed() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database seed...');
    
    // Create test user
    const passwordHash = await bcrypt.hash('testpass123', 10);
    
    const result = await client.query(`
      INSERT INTO users (email, password_hash, name, plan_tier, watches_limit)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        plan_tier = EXCLUDED.plan_tier,
        watches_limit = EXCLUDED.watches_limit,
        updated_at = NOW()
      RETURNING id, email, plan_tier, watches_limit
    `, ['test@watchpoint.io', passwordHash, 'Test User', 'pro', 50]);
    
    console.log('✓ Test user created/updated:', result.rows[0]);
    console.log('\n✅ Seed completed successfully!');
    
  } catch (error) {
    console.error('Seed failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
