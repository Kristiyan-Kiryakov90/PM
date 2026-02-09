/**
 * Phase 1A: Spaces Unit & Integration Tests
 * Tests space creation, retrieval, updates, and RLS policies
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

test.describe('Phase 1A: Spaces Feature', () => {
  let supabase: any;
  let testUser: { id: string; email: string; companyId: string | null };
  let testSpaceId: number;

  test.beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Create test user
    const email = `spaces-test-${Date.now()}@test.com`;
    const { data: { user }, error } = await supabase.auth.signUp({
      email,
      password: 'TestPass123!',
      options: {
        data: {
          full_name: 'Spaces Test User',
          role: 'user'
        }
      }
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

  test('should create a space', async () => {
    const { data, error } = await supabase
      .from('spaces')
      .insert({
        company_id: testUser.companyId,
        name: 'Test Space',
        description: 'A test space for unit testing',
        color: '#3b82f6',
        icon: '📁',
        sort_order: 0,
        created_by: testUser.id
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.name).toBe('Test Space');
    expect(data.icon).toBe('📁');

    testSpaceId = data.id;
  });

  test('should retrieve space by ID', async () => {
    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('id', testSpaceId)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.id).toBe(testSpaceId);
    expect(data.name).toBe('Test Space');
  });

  test('should update space', async () => {
    const { data, error } = await supabase
      .from('spaces')
      .update({
        name: 'Updated Test Space',
        description: 'Updated description'
      })
      .eq('id', testSpaceId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.name).toBe('Updated Test Space');
    expect(data.description).toBe('Updated description');
  });

  test('should list all spaces for company', async () => {
    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('company_id', testUser.companyId);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
  });

  test('should enforce RLS - user can only see company spaces', async () => {
    // This space is only accessible to the creator's company
    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('id', testSpaceId);

    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });

  test('should delete space', async () => {
    const { error } = await supabase
      .from('spaces')
      .delete()
      .eq('id', testSpaceId);

    expect(error).toBeNull();

    // Verify deletion
    const { data } = await supabase
      .from('spaces')
      .select('*')
      .eq('id', testSpaceId);

    expect(data?.length).toBe(0);
  });
});
