/**
 * Phase 2A: Comments & Mentions Unit & Integration Tests
 * Tests comment CRUD, threading, mentions, and real-time updates
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

test.describe('Phase 2A: Comments & Mentions', () => {
  let supabase: any;
  let testUser: { id: string; email: string; taskId: number };
  let testCommentId: number;
  let testReplyId: number;

  test.beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Create test user
    const email = `comments-test-${Date.now()}@test.com`;
    const { data: { user }, error } = await supabase.auth.signUp({
      email,
      password: 'TestPass123!',
      options: { data: { full_name: 'Comments Test User', role: 'user' } }
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
        title: 'Comments Test Task',
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

  test('should create a comment', async () => {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        task_id: testUser.taskId,
        author_id: testUser.id,
        content: 'This is a test comment',
        company_id: null,
        is_action_item: false
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.content).toBe('This is a test comment');
    expect(data.author_id).toBe(testUser.id);

    testCommentId = data.id;
  });

  test('should retrieve comment by ID', async () => {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('id', testCommentId)
      .single();

    expect(error).toBeNull();
    expect(data.id).toBe(testCommentId);
    expect(data.task_id).toBe(testUser.taskId);
  });

  test('should create a reply comment', async () => {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        task_id: testUser.taskId,
        parent_comment_id: testCommentId,
        author_id: testUser.id,
        content: 'This is a reply to the comment',
        company_id: null,
        is_action_item: false
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.parent_comment_id).toBe(testCommentId);
    expect(data.content).toBe('This is a reply to the comment');

    testReplyId = data.id;
  });

  test('should retrieve all comments for task', async () => {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('task_id', testUser.taskId);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((c: any) => c.id === testCommentId)).toBe(true);
  });

  test('should create mention', async () => {
    const { data, error } = await supabase
      .from('mentions')
      .insert({
        comment_id: testCommentId,
        mentioned_user_id: testUser.id
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.comment_id).toBe(testCommentId);
    expect(data.mentioned_user_id).toBe(testUser.id);
  });

  test('should retrieve mentions for comment', async () => {
    const { data, error } = await supabase
      .from('mentions')
      .select('*')
      .eq('comment_id', testCommentId);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  test('should edit comment', async () => {
    const { data, error } = await supabase
      .from('comments')
      .update({
        content: 'Edited test comment',
        edited_at: new Date().toISOString()
      })
      .eq('id', testCommentId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.content).toBe('Edited test comment');
    expect(data.edited_at).not.toBeNull();
  });

  test('should delete reply comment', async () => {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', testReplyId);

    expect(error).toBeNull();

    // Verify deletion
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('id', testReplyId);

    expect(data?.length).toBe(0);
  });

  test('should delete comment', async () => {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', testCommentId);

    expect(error).toBeNull();

    // Verify deletion
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('id', testCommentId);

    expect(data?.length).toBe(0);
  });

  test('should cascade delete mentions when comment is deleted', async () => {
    // Create comment with mention
    const { data: comment } = await supabase
      .from('comments')
      .insert({
        task_id: testUser.taskId,
        author_id: testUser.id,
        content: 'Comment for cascade test',
        company_id: null
      })
      .select()
      .single();

    const { data: mention } = await supabase
      .from('mentions')
      .insert({
        comment_id: comment.id,
        mentioned_user_id: testUser.id
      })
      .select()
      .single();

    // Delete comment
    await supabase.from('comments').delete().eq('id', comment.id);

    // Verify mention was also deleted
    const { data: remainingMentions } = await supabase
      .from('mentions')
      .select('*')
      .eq('id', mention.id);

    expect(remainingMentions?.length).toBe(0);
  });
});
