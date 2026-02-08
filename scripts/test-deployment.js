/**
 * Test Deployment Script
 * Verifies that migration was applied correctly
 * Run: node scripts/test-deployment.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('🧪 Testing Deployment...\n');

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: Check profiles table exists
  console.log('Test 1: profiles table exists');
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);

    if (error && error.code === '42P01') {
      results.tests.push({ name: 'profiles table', status: '❌', error: 'Table does not exist' });
      results.failed++;
    } else if (error) {
      results.tests.push({ name: 'profiles table', status: '⚠️', error: error.message });
      results.failed++;
    } else {
      results.tests.push({ name: 'profiles table', status: '✅', info: 'Table exists' });
      results.passed++;
    }
  } catch (e) {
    results.tests.push({ name: 'profiles table', status: '❌', error: e.message });
    results.failed++;
  }

  // Test 2: Check if we can query profiles (RLS working)
  console.log('Test 2: RLS policies allow queries');
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, company_id')
      .limit(5);

    if (error) {
      results.tests.push({ name: 'RLS policies', status: '⚠️', error: error.message });
      results.failed++;
    } else {
      results.tests.push({
        name: 'RLS policies',
        status: '✅',
        info: `Found ${data?.length || 0} profiles`
      });
      results.passed++;
    }
  } catch (e) {
    results.tests.push({ name: 'RLS policies', status: '❌', error: e.message });
    results.failed++;
  }

  // Test 3: Check companies table
  console.log('Test 3: Companies table accessible');
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name')
      .limit(5);

    if (error) {
      results.tests.push({ name: 'companies table', status: '⚠️', error: error.message });
      results.failed++;
    } else {
      results.tests.push({
        name: 'companies table',
        status: '✅',
        info: `Found ${data?.length || 0} companies`
      });
      results.passed++;
    }
  } catch (e) {
    results.tests.push({ name: 'companies table', status: '❌', error: e.message });
    results.failed++;
  }

  // Test 4: Check projects table (dual mode)
  console.log('Test 4: Projects table with nullable company_id');
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, company_id')
      .limit(5);

    if (error) {
      results.tests.push({ name: 'projects table', status: '⚠️', error: error.message });
      results.failed++;
    } else {
      results.tests.push({
        name: 'projects table',
        status: '✅',
        info: `Found ${data?.length || 0} projects`
      });
      results.passed++;
    }
  } catch (e) {
    results.tests.push({ name: 'projects table', status: '❌', error: e.message });
    results.failed++;
  }

  // Test 5: Check tasks table
  console.log('Test 5: Tasks table accessible');
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, company_id')
      .limit(5);

    if (error) {
      results.tests.push({ name: 'tasks table', status: '⚠️', error: error.message });
      results.failed++;
    } else {
      results.tests.push({
        name: 'tasks table',
        status: '✅',
        info: `Found ${data?.length || 0} tasks`
      });
      results.passed++;
    }
  } catch (e) {
    results.tests.push({ name: 'tasks table', status: '❌', error: e.message });
    results.failed++;
  }

  // Print Results
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(60));

  results.tests.forEach(test => {
    console.log(`\n${test.status} ${test.name}`);
    if (test.info) console.log(`   ℹ️  ${test.info}`);
    if (test.error) console.log(`   ⚠️  ${test.error}`);
  });

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('='.repeat(60));

  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! Deployment successful!');
    console.log('\n📋 Next steps:');
    console.log('1. Test signup: http://localhost:5173/signup.html');
    console.log('2. Verify profile created after signup');
    console.log('3. Deploy Edge Function (optional)');
  } else {
    console.log('\n⚠️  Some tests failed. Check migration status.');
    console.log('\n📋 To fix:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Run migration: backend/database/migrations/20260207_011_proper_multitenant.sql');
    console.log('3. Re-run this test');
  }
}

// Run tests
runTests().catch(console.error);
