/**
 * Phase 1: User Journey Tests
 * Single user logs in once and tests all Phase 1 functionality
 * Simulates realistic user workflow
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

test.describe.serial('Phase 1: Complete User Journey', () => {
  let supabase: any;
  let testUser: { id: string; email: string; companyId: string | null };
  let testProject: { id: number; name: string };
  let testTask: { id: number; title: string };
  let testSpace: { id: number; name: string };
  let testStatus: { id: number; name: string };
  let testChecklist: { id: number; title: string };

  test('Step 1: Setup - Create and authenticate test user', async () => {
    supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Use consistent test email
    const testEmail = `phase1-journey-${Date.now()}@test.com`;

    // Sign up new user
    const { data: { user }, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPass123!',
      options: {
        data: {
          full_name: 'Phase 1 Test User',
          role: 'user'
        }
      }
    });

    expect(signUpError).toBeNull();
    expect(user).toBeDefined();
    expect(user?.id).toBeDefined();

    // Sign in
    const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: 'TestPass123!'
    });

    expect(signInError).toBeNull();
    expect(session).toBeDefined();

    // Get company ID from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user!.id)
      .single();

    expect(profileError).toBeNull();

    testUser = {
      id: user!.id,
      email: testEmail,
      companyId: profile?.company_id || null
    };

    expect(testUser.id).toBeDefined();
  });

  test('Step 2: Create a Space (Phase 1A)', async () => {
    const { data: space, error } = await supabase
      .from('spaces')
      .insert({
        company_id: testUser.companyId,
        name: 'My Workspace',
        description: 'Personal workspace for testing',
        color: '#3b82f6',
        icon: '📁',
        sort_order: 0,
        created_by: testUser.id
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(space).toBeDefined();
    expect(space.name).toBe('My Workspace');

    testSpace = space;
  });

  test('Step 3: Create a Project', async () => {
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        company_id: testUser.companyId,
        space_id: testSpace.id,
        name: 'Website Redesign',
        description: 'Redesign the company website',
        created_by: testUser.id,
        color: '#3b82f6',
        icon: '🎨'
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(project).toBeDefined();
    expect(project.name).toBe('Website Redesign');

    testProject = project;
  });

  test('Step 4: Create Custom Status (Phase 1B)', async () => {
    const { data: status, error } = await supabase
      .from('status_definitions')
      .insert({
        project_id: testProject.id,
        company_id: testUser.companyId,
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
    expect(status).toBeDefined();
    expect(status.name).toBe('In Review');

    testStatus = status;
  });

  test('Step 5: Create a Task', async () => {
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        company_id: testUser.companyId,
        project_id: testProject.id,
        title: 'Design homepage mockup',
        description: 'Create high-fidelity mockups for the homepage',
        status: 'todo',
        priority: 'high',
        created_by: testUser.id
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(task).toBeDefined();
    expect(task.title).toBe('Design homepage mockup');

    testTask = task;
  });

  test('Step 6: Create Checklist and Items (Phase 1C)', async () => {
    // Create checklist
    const { data: checklist, error: checklistError } = await supabase
      .from('checklists')
      .insert({
        task_id: testTask.id,
        title: 'Design Tasks',
        sort_order: 0
      })
      .select()
      .single();

    expect(checklistError).toBeNull();
    expect(checklist).toBeDefined();

    testChecklist = checklist;

    // Add first item
    const { data: item1, error: item1Error } = await supabase
      .from('checklist_items')
      .insert({
        checklist_id: checklist.id,
        content: 'Create wireframes',
        is_completed: false,
        sort_order: 0
      })
      .select()
      .single();

    expect(item1Error).toBeNull();
    expect(item1.content).toBe('Create wireframes');

    // Add second item
    const { data: item2, error: item2Error } = await supabase
      .from('checklist_items')
      .insert({
        checklist_id: checklist.id,
        content: 'Get design approval',
        is_completed: false,
        sort_order: 1
      })
      .select()
      .single();

    expect(item2Error).toBeNull();
    expect(item2.content).toBe('Get design approval');

    // Mark first item complete
    const { data: completedItem, error: completeError } = await supabase
      .from('checklist_items')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString()
      })
      .eq('id', item1.id)
      .select()
      .single();

    expect(completeError).toBeNull();
    expect(completedItem.is_completed).toBe(true);
  });

  test('Step 7: Update Task Status', async () => {
    const { data: updatedTask, error } = await supabase
      .from('tasks')
      .update({
        status: 'in_progress',
        assigned_to: testUser.id
      })
      .eq('id', testTask.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(updatedTask.status).toBe('in_progress');
    expect(updatedTask.assigned_to).toBe(testUser.id);
  });

  test('Step 8: Verify Space with Projects', async () => {
    const { data: spaces, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('id', testSpace.id);

    expect(error).toBeNull();
    expect(spaces?.length).toBe(1);
    expect(spaces?.[0].name).toBe('My Workspace');
  });

  test('Step 9: Verify Project with Tasks', async () => {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', testProject.id);

    expect(error).toBeNull();
    expect(projects?.length).toBe(1);
    expect(projects?.[0].space_id).toBe(testSpace.id);
  });

  test('Step 10: Verify Checklist Items', async () => {
    const { data: items, error } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('checklist_id', testChecklist.id)
      .order('sort_order', { ascending: true });

    expect(error).toBeNull();
    expect(items?.length).toBe(2);
    expect(items?.[0].content).toBe('Create wireframes');
    expect(items?.[0].is_completed).toBe(true);
    expect(items?.[1].content).toBe('Get design approval');
    expect(items?.[1].is_completed).toBe(false);
  });

  test('Cleanup: Delete all test data', async () => {
    // Delete checklist (cascade deletes items)
    const { error: checklistError } = await supabase
      .from('checklists')
      .delete()
      .eq('id', testChecklist.id);

    expect(checklistError).toBeNull();

    // Delete task
    const { error: taskError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', testTask.id);

    expect(taskError).toBeNull();

    // Delete status
    const { error: statusError } = await supabase
      .from('status_definitions')
      .delete()
      .eq('id', testStatus.id);

    expect(statusError).toBeNull();

    // Delete project
    const { error: projectError } = await supabase
      .from('projects')
      .delete()
      .eq('id', testProject.id);

    expect(projectError).toBeNull();

    // Delete space
    const { error: spaceError } = await supabase
      .from('spaces')
      .delete()
      .eq('id', testSpace.id);

    expect(spaceError).toBeNull();
  });
});
