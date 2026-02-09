/**
 * Phase 1C: Subtasks & Checklists Unit & Integration Tests
 * Tests checklist and checklist item CRUD operations
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

test.describe('Phase 1C: Subtasks & Checklists', () => {
  let supabase: any;
  let testUser: { id: string; email: string; taskId: number };
  let testChecklistId: number;
  let testItemId: number;

  test.beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Create test user
    const email = `checklists-test-${Date.now()}@test.com`;
    const { data: { user }, error } = await supabase.auth.signUp({
      email,
      password: 'TestPass123!',
      options: { data: { full_name: 'Checklists Test User', role: 'user' } }
    });

    if (error || !user) throw new Error(`Failed to create test user: ${error?.message}`);

    // Sign in
    const { data: { session } } = await supabase.auth.signInWithPassword({
      email,
      password: 'TestPass123!'
    });

    if (!session) throw new Error('Failed to sign in');

    // Create test task
    const { data: task } = await supabase
      .from('tasks')
      .insert({
        company_id: null,
        title: 'Checklists Test Task',
        created_by: user.id
      })
      .select()
      .single();

    testUser = {
      id: user.id,
      email,
      taskId: task.id
    };
  });

  test('should create a checklist', async () => {
    const { data, error } = await supabase
      .from('checklists')
      .insert({
        task_id: testUser.taskId,
        title: 'Test Checklist',
        sort_order: 0
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.title).toBe('Test Checklist');

    testChecklistId = data.id;
  });

  test('should retrieve checklist by ID', async () => {
    const { data, error } = await supabase
      .from('checklists')
      .select('*')
      .eq('id', testChecklistId)
      .single();

    expect(error).toBeNull();
    expect(data.id).toBe(testChecklistId);
    expect(data.task_id).toBe(testUser.taskId);
  });

  test('should create checklist item', async () => {
    const { data, error } = await supabase
      .from('checklist_items')
      .insert({
        checklist_id: testChecklistId,
        content: 'First checklist item',
        is_completed: false,
        sort_order: 0
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.content).toBe('First checklist item');
    expect(data.is_completed).toBe(false);

    testItemId = data.id;
  });

  test('should mark checklist item as completed', async () => {
    const { data, error } = await supabase
      .from('checklist_items')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString()
      })
      .eq('id', testItemId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.is_completed).toBe(true);
    expect(data.completed_at).not.toBeNull();
  });

  test('should unmark completed checklist item', async () => {
    const { data, error } = await supabase
      .from('checklist_items')
      .update({
        is_completed: false,
        completed_at: null
      })
      .eq('id', testItemId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.is_completed).toBe(false);
    expect(data.completed_at).toBeNull();
  });

  test('should list all items in checklist', async () => {
    const { data, error } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('checklist_id', testChecklistId);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test('should delete checklist item', async () => {
    const { error } = await supabase
      .from('checklist_items')
      .delete()
      .eq('id', testItemId);

    expect(error).toBeNull();

    // Verify deletion
    const { data } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('id', testItemId);

    expect(data?.length).toBe(0);
  });

  test('should delete checklist', async () => {
    const { error } = await supabase
      .from('checklists')
      .delete()
      .eq('id', testChecklistId);

    expect(error).toBeNull();

    // Verify deletion
    const { data } = await supabase
      .from('checklists')
      .select('*')
      .eq('id', testChecklistId);

    expect(data?.length).toBe(0);
  });

  test('should cascade delete checklist items when checklist is deleted', async () => {
    // Create new checklist with items
    const { data: newChecklist } = await supabase
      .from('checklists')
      .insert({
        task_id: testUser.taskId,
        title: 'Cascade Test Checklist',
        sort_order: 0
      })
      .select()
      .single();

    const { data: item } = await supabase
      .from('checklist_items')
      .insert({
        checklist_id: newChecklist.id,
        content: 'Item to cascade delete',
        is_completed: false
      })
      .select()
      .single();

    // Delete checklist
    await supabase.from('checklists').delete().eq('id', newChecklist.id);

    // Verify item was also deleted
    const { data: remainingItems } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('id', item.id);

    expect(remainingItems?.length).toBe(0);
  });
});
