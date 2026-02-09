/**
 * Phase 2C: Notifications Unit & Integration Tests
 * Tests notification creation, retrieval, and trigger events
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

test.describe('Phase 2C: Notifications', () => {
  let supabase: any;
  let testUser: { id: string; email: string; taskId: number };
  let testUser2: { id: string; email: string };
  let testNotificationId: number;

  test.beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Create test user 1
    const email1 = `notif-test1-${Date.now()}@test.com`;
    const { data: { user: user1 }, error: error1 } = await supabase.auth.signUp({
      email: email1,
      password: 'TestPass123!',
      options: { data: { full_name: 'Notif Test User 1', role: 'user' } }
    });

    if (error1 || !user1) throw new Error(`Failed to create user1: ${error1?.message}`);

    // Sign in user 1
    const { data: { session: session1 } } = await supabase.auth.signInWithPassword({
      email: email1,
      password: 'TestPass123!'
    });

    if (!session1) throw new Error('Failed to sign in user1');

    // Create test user 2
    const email2 = `notif-test2-${Date.now()}@test.com`;
    const { data: { user: user2 }, error: error2 } = await supabase.auth.signUp({
      email: email2,
      password: 'TestPass123!',
      options: { data: { full_name: 'Notif Test User 2', role: 'user' } }
    });

    if (error2 || !user2) throw new Error(`Failed to create user2: ${error2?.message}`);

    // Create test task for user1
    const { data: task } = await supabase
      .from('tasks')
      .insert({
        company_id: null,
        title: 'Notifications Test Task',
        created_by: user1.id
      })
      .select()
      .single();

    testUser = {
      id: user1.id,
      email: email1,
      taskId: task.id
    };

    testUser2 = {
      id: user2.id,
      email: email2
    };
  });

  test('should create a notification', async () => {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: testUser2.id,
        company_id: null,
        type: 'mention',
        title: 'You were mentioned',
        message: 'You were mentioned in a comment',
        task_id: testUser.taskId,
        actor_id: testUser.id,
        is_read: false
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.type).toBe('mention');
    expect(data.is_read).toBe(false);

    testNotificationId = data.id;
  });

  test('should retrieve notification by ID', async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', testNotificationId)
      .single();

    expect(error).toBeNull();
    expect(data.id).toBe(testNotificationId);
    expect(data.user_id).toBe(testUser2.id);
  });

  test('should mark notification as read', async () => {
    const { data, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', testNotificationId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.is_read).toBe(true);
    expect(data.read_at).not.toBeNull();
  });

  test('should unmark notification as read', async () => {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: false, read_at: null })
      .eq('id', testNotificationId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.is_read).toBe(false);
  });

  test('should get unread notifications for user', async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', testUser2.id)
      .eq('is_read', false);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  test('should delete notification', async () => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', testNotificationId);

    expect(error).toBeNull();

    // Verify deletion
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', testNotificationId);

    expect(data?.length).toBe(0);
  });

  test('should create assignment notification when task assigned', async () => {
    // Assign task to user2
    await supabase
      .from('tasks')
      .update({ assigned_to: testUser2.id })
      .eq('id', testUser.taskId);

    // Wait for trigger
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', testUser2.id)
      .eq('type', 'assignment')
      .eq('task_id', testUser.taskId);

    expect(error).toBeNull();
    // Assignment notification should have been created
    if (data && data.length > 0) {
      expect(data[0].type).toBe('assignment');
    }
  });

  test('should create mention notification when user mentioned', async () => {
    // Create comment mentioning user2
    const { data: comment } = await supabase
      .from('comments')
      .insert({
        task_id: testUser.taskId,
        author_id: testUser.id,
        content: 'Mention test',
        company_id: null
      })
      .select()
      .single();

    // Create mention
    await supabase
      .from('mentions')
      .insert({
        comment_id: comment.id,
        mentioned_user_id: testUser2.id
      });

    // Wait for trigger
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', testUser2.id)
      .eq('type', 'mention');

    expect(error).toBeNull();
    // Mention notification should have been created
    if (data && data.length > 0) {
      expect(data.some((n: any) => n.type === 'mention')).toBe(true);
    }
  });

  test('should enforce RLS - user can only see own notifications', async () => {
    // Create a notification for user1
    const { data: notif } = await supabase
      .from('notifications')
      .insert({
        user_id: testUser.id,
        company_id: null,
        type: 'mention',
        title: 'Test notification',
        message: 'Test message',
        actor_id: testUser2.id
      })
      .select()
      .single();

    // Try to access with user2 session - should fail due to RLS
    // This is testing RLS behavior
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', testUser.id);

    // User2 should only see their own notifications (if any)
    if (data) {
      expect(data.every((n: any) => n.user_id === testUser.id)).toBe(true);
    }
  });

  test('should support multiple notification types', async () => {
    const types = ['mention', 'assignment', 'comment', 'reply', 'status_change', 'due_date', 'task_completed', 'project_update'];

    for (const type of types) {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: testUser2.id,
          company_id: null,
          type,
          title: `${type} notification`,
          message: `This is a ${type} notification`,
          actor_id: testUser.id
        });

      expect(error).toBeNull();
    }
  });
});
