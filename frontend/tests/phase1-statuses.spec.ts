/**
 * Phase 1B: Custom Statuses Unit & Integration Tests
 * Tests status creation, project-specific statuses, and default statuses
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

test.describe('Phase 1B: Custom Statuses', () => {
  let supabase: any;
  let testUser: { id: string; email: string; projectId: number };
  let testStatusId: number;

  test.beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Create test user
    const email = `statuses-test-${Date.now()}@test.com`;
    const { data: { user }, error } = await supabase.auth.signUp({
      email,
      password: 'TestPass123!',
      options: { data: { full_name: 'Statuses Test User', role: 'user' } }
    });

    if (error || !user) throw new Error(`Failed to create test user: ${error?.message}`);

    // Sign in
    const { data: { session } } = await supabase.auth.signInWithPassword({
      email,
      password: 'TestPass123!'
    });

    if (!session) throw new Error('Failed to sign in');

    // Create test project
    const { data: project } = await supabase
      .from('projects')
      .insert({
        company_id: null,
        name: 'Statuses Test Project',
        created_by: user.id
      })
      .select()
      .single();

    testUser = {
      id: user.id,
      email,
      projectId: project.id
    };
  });

  test('should create a custom status', async () => {
    const { data, error } = await supabase
      .from('status_definitions')
      .insert({
        project_id: testUser.projectId,
        company_id: null,
        name: 'In Review',
        slug: 'in_review',
        color: '#f59e0b',
        sort_order: 0,
        is_done: false,
        is_default: false
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.name).toBe('In Review');
    expect(data.slug).toBe('in_review');

    testStatusId = data.id;
  });

  test('should retrieve status by ID', async () => {
    const { data, error } = await supabase
      .from('status_definitions')
      .select('*')
      .eq('id', testStatusId)
      .single();

    expect(error).toBeNull();
    expect(data.id).toBe(testStatusId);
    expect(data.name).toBe('In Review');
  });

  test('should list all statuses for project', async () => {
    const { data, error } = await supabase
      .from('status_definitions')
      .select('*')
      .eq('project_id', testUser.projectId);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((s: any) => s.id === testStatusId)).toBe(true);
  });

  test('should update status', async () => {
    const { data, error } = await supabase
      .from('status_definitions')
      .update({
        name: 'Under Review',
        is_done: false
      })
      .eq('id', testStatusId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.name).toBe('Under Review');
  });

  test('should mark status as done', async () => {
    const { data, error } = await supabase
      .from('status_definitions')
      .update({ is_done: true })
      .eq('id', testStatusId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.is_done).toBe(true);
  });

  test('should delete status', async () => {
    const { error } = await supabase
      .from('status_definitions')
      .delete()
      .eq('id', testStatusId);

    expect(error).toBeNull();

    // Verify deletion
    const { data } = await supabase
      .from('status_definitions')
      .select('*')
      .eq('id', testStatusId);

    expect(data?.length).toBe(0);
  });

  test('should enforce color format validation', async () => {
    const { error } = await supabase
      .from('status_definitions')
      .insert({
        project_id: testUser.projectId,
        company_id: null,
        name: 'Invalid Color Status',
        slug: 'invalid_color',
        color: 'invalid-color', // Invalid hex format
        sort_order: 0
      })
      .select()
      .single();

    expect(error).not.toBeNull();
  });
});
