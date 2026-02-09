/**
 * Phase 2D: Team Members Unit & Integration Tests
 * Tests user status, team member queries, and real-time updates
 */

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

test.describe('Phase 2D: Team Members', () => {
  let supabase: any;
  let testUser: { id: string; email: string; companyId: string | null };

  test.beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Create test user
    const email = `team-test-${Date.now()}@test.com`;
    const { data: { user }, error } = await supabase.auth.signUp({
      email,
      password: 'TestPass123!',
      options: { data: { full_name: 'Team Test User', role: 'user' } }
    });

    if (error || !user) throw new Error(`Failed to create test user: ${error?.message}`);

    // Sign in
    const { data: { session } } = await supabase.auth.signInWithPassword({
      email,
      password: 'TestPass123!'
    });

    if (!session) throw new Error('Failed to sign in');

    // Get company ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    testUser = {
      id: user.id,
      email,
      companyId: profile?.company_id || null
    };
  });

  test('should create user status record', async () => {
    const { data, error } = await supabase
      .from('user_status')
      .insert({
        user_id: testUser.id,
        status: 'online',
        status_message: 'Working on tasks',
        last_seen: new Date().toISOString()
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.status).toBe('online');
    expect(data.status_message).toBe('Working on tasks');
  });

  test('should retrieve user status by ID', async () => {
    const { data, error } = await supabase
      .from('user_status')
      .select('*')
      .eq('user_id', testUser.id)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.user_id).toBe(testUser.id);
  });

  test('should update user status to away', async () => {
    const { data, error } = await supabase
      .from('user_status')
      .update({
        status: 'away',
        status_message: 'In a meeting'
      })
      .eq('user_id', testUser.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.status).toBe('away');
    expect(data.status_message).toBe('In a meeting');
  });

  test('should update user status to busy', async () => {
    const { data, error } = await supabase
      .from('user_status')
      .update({
        status: 'busy',
        status_message: 'In deep work'
      })
      .eq('user_id', testUser.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.status).toBe('busy');
  });

  test('should update user status to offline', async () => {
    const { data, error } = await supabase
      .from('user_status')
      .update({ status: 'offline' })
      .eq('user_id', testUser.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.status).toBe('offline');
  });

  test('should update last_seen timestamp', async () => {
    const beforeTime = new Date();

    const { data, error } = await supabase
      .from('user_status')
      .update({
        last_seen: beforeTime.toISOString(),
        status: 'online'
      })
      .eq('user_id', testUser.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.last_seen).not.toBeNull();
  });

  test('should get company team members', async () => {
    const { data, error } = await supabase.rpc('get_company_team_members', {
      p_company_id: testUser.companyId
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    // Should include our test user
    expect(data.some((member: any) => member.user_id === testUser.id)).toBe(true);
  });

  test('should include user details in team members query', async () => {
    const { data, error } = await supabase.rpc('get_company_team_members', {
      p_company_id: testUser.companyId
    });

    expect(error).toBeNull();
    const testMember = data.find((m: any) => m.user_id === testUser.id);

    if (testMember) {
      expect(testMember).toHaveProperty('email');
      expect(testMember).toHaveProperty('full_name');
      expect(testMember).toHaveProperty('role');
      expect(testMember).toHaveProperty('status');
    }
  });

  test('should enforce status enum validation', async () => {
    const { error } = await supabase
      .from('user_status')
      .insert({
        user_id: testUser.id,
        status: 'invalid_status' // Invalid status
      });

    expect(error).not.toBeNull();
  });

  test('should handle NULL status message', async () => {
    const { data, error } = await supabase
      .from('user_status')
      .update({
        status: 'online',
        status_message: null
      })
      .eq('user_id', testUser.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.status_message).toBeNull();
  });

  test('should have unique constraint on user_id', async () => {
    // Try to insert duplicate user status
    const { error } = await supabase
      .from('user_status')
      .insert({
        user_id: testUser.id,
        status: 'online'
      });

    // Should fail due to unique constraint
    expect(error).not.toBeNull();
  });

  test('should delete user status on user deletion (cascade)', async () => {
    // Create a temporary test user
    const tempEmail = `temp-user-${Date.now()}@test.com`;
    const { data: { user: tempUser } } = await supabase.auth.signUp({
      email: tempEmail,
      password: 'TestPass123!',
      options: { data: { full_name: 'Temp User', role: 'user' } }
    });

    if (tempUser) {
      // Create status for temp user
      await supabase
        .from('user_status')
        .insert({
          user_id: tempUser.id,
          status: 'online'
        });

      // Verify status exists
      const { data: statusBefore } = await supabase
        .from('user_status')
        .select('*')
        .eq('user_id', tempUser.id);

      expect(statusBefore?.length).toBe(1);

      // Delete user
      const { error: deleteError } = await supabase.auth.admin.deleteUser(tempUser.id);
      expect(deleteError).toBeNull();

      // Wait for cascade delete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify status was deleted
      const { data: statusAfter } = await supabase
        .from('user_status')
        .select('*')
        .eq('user_id', tempUser.id);

      expect(statusAfter?.length).toBe(0);
    }
  });
});
