/**
 * Phase 2: User Journey Tests
 * Single user tests all Phase 2 features in realistic workflow
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

test.describe.serial('Phase 2: Complete User Journey', () => {
  let supabase: any;
  let testUser: { id: string; email: string; companyId: string | null };
  let testTask: { id: number; title: string };
  let testComment: { id: number; content: string };
  let testReply: { id: number; content: string };
  let testNotification: { id: number; type: string };

  test('Step 1: Setup - Authenticate test user', async () => {
    supabase = createClient(supabaseUrl, supabaseAnonKey);

    const testEmail = `phase2-journey-${Date.now()}@test.com`;

    // Sign up
    const { data: { user }, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPass123!',
      options: { data: { full_name: 'Phase 2 Test User', role: 'user' } }
    });

    expect(signUpError).toBeNull();
    expect(user).toBeDefined();

    // Sign in
    const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: 'TestPass123!'
    });

    expect(signInError).toBeNull();

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user!.id)
      .single();

    testUser = {
      id: user!.id,
      email: testEmail,
      companyId: profile?.company_id || null
    };
  });

  test('Step 2: Create test task', async () => {
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        company_id: testUser.companyId,
        title: 'Design Review Meeting',
        description: 'Review design mockups with team',
        created_by: testUser.id
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(task.title).toBe('Design Review Meeting');

    testTask = task;
  });

  test('Step 3: Post a comment (Phase 2A)', async () => {
    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        task_id: testTask.id,
        author_id: testUser.id,
        content: 'Let\'s discuss the color scheme for the dashboard',
        company_id: testUser.companyId,
        is_action_item: false
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(comment.content).toBe('Let\'s discuss the color scheme for the dashboard');

    testComment = comment;
  });

  test('Step 4: Reply to comment (Phase 2A)', async () => {
    const { data: reply, error } = await supabase
      .from('comments')
      .insert({
        task_id: testTask.id,
        parent_comment_id: testComment.id,
        author_id: testUser.id,
        content: 'I suggest using a blue and white theme',
        company_id: testUser.companyId,
        is_action_item: false
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(reply.parent_comment_id).toBe(testComment.id);
    expect(reply.content).toBe('I suggest using a blue and white theme');

    testReply = reply;
  });

  test('Step 5: Verify comment was created', async () => {
    // Verify the comment exists
    const { data: comments, error } = await supabase
      .from('comments')
      .select('*')
      .eq('id', testComment.id)
      .single();

    expect(error).toBeNull();
    expect(comments).toBeDefined();
    expect(comments.content).toBe('Let\'s discuss the color scheme for the dashboard');
  });

  test('Step 6: Verify activity log for task creation', async () => {
    // Wait for trigger
    await new Promise(r => setTimeout(r, 2000));

    const { data: activities, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('entity_type', 'task')
      .eq('entity_id', testTask.id)
      .order('created_at', { ascending: false });

    expect(error).toBeNull();
    expect(activities?.length).toBeGreaterThan(0);

    const createdActivity = activities?.find((a: any) => a.action === 'created');
    expect(createdActivity).toBeDefined();
    expect(createdActivity?.actor_id).toBe(testUser.id);
  });

  test('Step 7: Update task and verify activity log', async () => {
    // Update task
    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        status: 'in_progress',
        assigned_to: testUser.id
      })
      .eq('id', testTask.id);

    expect(updateError).toBeNull();

    // Wait for trigger
    await new Promise(r => setTimeout(r, 2000));

    const { data: activities, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('entity_type', 'task')
      .eq('entity_id', testTask.id);

    expect(error).toBeNull();

    const updateActivity = activities?.find((a: any) => a.action === 'updated');
    expect(updateActivity).toBeDefined();
  });

  test('Step 8: Create notification manually', async () => {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: testUser.id,
        company_id: testUser.companyId,
        type: 'mention',
        title: 'You were mentioned',
        message: 'You were mentioned in a comment',
        task_id: testTask.id,
        actor_id: testUser.id,
        is_read: false
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(notification.type).toBe('mention');
    expect(notification.is_read).toBe(false);

    testNotification = notification;
  });

  test('Step 9: Mark notification as read (Phase 2C)', async () => {
    const { data: readNotification, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', testNotification.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(readNotification.is_read).toBe(true);
  });

  test('Step 10: Create user status (Phase 2D)', async () => {
    const { data: status, error } = await supabase
      .from('user_status')
      .upsert({
        user_id: testUser.id,
        status: 'online',
        status_message: 'Working on design mockups',
        last_seen: new Date().toISOString()
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(status.status).toBe('online');
  });

  test('Step 11: Update user status', async () => {
    const { data: updatedStatus, error } = await supabase
      .from('user_status')
      .update({
        status: 'away',
        status_message: 'In a meeting'
      })
      .eq('user_id', testUser.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(updatedStatus.status).toBe('away');
  });

  test('Step 12: Verify user status was updated', async () => {
    const { data: userStatus, error } = await supabase
      .from('user_status')
      .select('*')
      .eq('user_id', testUser.id)
      .single();

    expect(error).toBeNull();
    expect(userStatus.status).toBe('away');
    expect(userStatus.status_message).toBe('In a meeting');
  });

  test('Step 13: Retrieve all comments for task', async () => {
    const { data: comments, error } = await supabase
      .from('comments')
      .select('*')
      .eq('task_id', testTask.id)
      .order('created_at', { ascending: true });

    expect(error).toBeNull();
    expect(comments?.length).toBe(2);
    expect(comments?.[0].id).toBe(testComment.id);
    expect(comments?.[1].parent_comment_id).toBe(testComment.id);
  });

  test('Step 14: Get user notifications', async () => {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', testUser.id)
      .order('created_at', { ascending: false });

    expect(error).toBeNull();
    expect(Array.isArray(notifications)).toBe(true);
  });

  test('Step 15: Edit comment', async () => {
    const { data: editedComment, error } = await supabase
      .from('comments')
      .update({
        content: 'Let\'s discuss the updated color scheme for the dashboard',
        edited_at: new Date().toISOString()
      })
      .eq('id', testComment.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(editedComment.edited_at).not.toBeNull();
  });

  test('Cleanup: Delete all test data', async () => {
    // Delete comments
    await supabase
      .from('comments')
      .delete()
      .eq('task_id', testTask.id);

    // Delete notifications
    await supabase
      .from('notifications')
      .delete()
      .eq('task_id', testTask.id);

    // Delete task
    const { error: taskError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', testTask.id);

    expect(taskError).toBeNull();

    // Delete user status
    await supabase
      .from('user_status')
      .delete()
      .eq('user_id', testUser.id);
  });
});
