/**
 * Phase 2B: Activity Log Unit & Integration Tests
 * Tests activity log creation, retrieval, and automatic tracking
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

test.describe('Phase 2B: Activity Log', () => {
  let supabase: any;
  let testUser: { id: string; email: string; projectId: number; taskId: number };

  test.beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Create test user
    const email = `activity-test-${Date.now()}@test.com`;
    const { data: { user }, error } = await supabase.auth.signUp({
      email,
      password: 'TestPass123!',
      options: { data: { full_name: 'Activity Test User', role: 'user' } }
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
        name: 'Activity Test Project',
        created_by: user.id
      })
      .select()
      .single();

    // Create test task
    const { data: task } = await supabase
      .from('tasks')
      .insert({
        company_id: null,
        project_id: project.id,
        title: 'Activity Test Task',
        created_by: user.id
      })
      .select()
      .single();

    testUser = {
      id: user.id,
      email,
      projectId: project.id,
      taskId: task.id
    };
  });

  test('should have activity log entry for project creation', async () => {
    // Wait a moment for trigger to process
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('entity_type', 'project')
      .eq('entity_id', testUser.projectId);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((a: any) => a.action === 'created')).toBe(true);
  });

  test('should have activity log entry for task creation', async () => {
    // Wait a moment for trigger to process
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('entity_type', 'task')
      .eq('entity_id', testUser.taskId);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((a: any) => a.action === 'created')).toBe(true);
  });

  test('should create activity log entry when task is updated', async () => {
    // Update task
    await supabase
      .from('tasks')
      .update({ title: 'Updated Activity Test Task' })
      .eq('id', testUser.taskId);

    // Wait for trigger
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('entity_type', 'task')
      .eq('entity_id', testUser.taskId);

    expect(error).toBeNull();
    expect(data.some((a: any) => a.action === 'updated')).toBe(true);
  });

  test('should create activity log entry when task status changes', async () => {
    // Update task status
    await supabase
      .from('tasks')
      .update({ status: 'in_progress' })
      .eq('id', testUser.taskId);

    // Wait for trigger
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('entity_type', 'task')
      .eq('entity_id', testUser.taskId)
      .eq('action', 'status_changed');

    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });

  test('should create activity log entry when task is assigned', async () => {
    // Assign task
    await supabase
      .from('tasks')
      .update({ assigned_to: testUser.id })
      .eq('id', testUser.taskId);

    // Wait for trigger
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('entity_type', 'task')
      .eq('entity_id', testUser.taskId)
      .eq('action', 'assigned');

    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });

  test('should retrieve activity log entries ordered by timestamp', async () => {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    // Verify order
    if (data.length > 1) {
      for (let i = 0; i < data.length - 1; i++) {
        const time1 = new Date(data[i].created_at).getTime();
        const time2 = new Date(data[i + 1].created_at).getTime();
        expect(time1).toBeGreaterThanOrEqual(time2);
      }
    }
  });

  test('should store activity details in JSON', async () => {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('entity_type', 'task')
      .eq('entity_id', testUser.taskId)
      .limit(1)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(typeof data.details).toBe('object');
  });

  test('should filter activity log by actor', async () => {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('actor_id', testUser.id);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data.every((a: any) => a.actor_id === testUser.id)).toBe(true);
  });
});
