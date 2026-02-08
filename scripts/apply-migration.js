/**
 * Script to apply database migration
 * Run: node scripts/apply-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Get Supabase credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🚀 Starting migration...\n');

  // Read migration file
  const migrationPath = path.join(__dirname, '../backend/database/migrations/20260207_011_proper_multitenant.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Migration file loaded');
  console.log(`📊 Size: ${migrationSQL.length} characters`);
  console.log('⏳ Applying migration...\n');

  try {
    // Execute the migration
    // Note: Supabase client doesn't support raw SQL directly
    // We need to use the REST API or suggest using the Dashboard

    console.log('⚠️  This script requires manual application via Supabase Dashboard');
    console.log('\n📋 Steps to apply migration:');
    console.log('1. Go to: https://app.supabase.com/project/zuupemhuaovzqqhyyocz');
    console.log('2. Click: SQL Editor → New Query');
    console.log('3. Copy the content of: backend/database/migrations/20260207_011_proper_multitenant.sql');
    console.log('4. Paste and click Run');
    console.log('\n✅ The migration will create:');
    console.log('   - profiles table');
    console.log('   - Tenant-safe composite FKs');
    console.log('   - Updated RLS policies');
    console.log('   - Performance indexes');
    console.log('\n💡 Alternative: Use psql with your database URL');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run
applyMigration();
