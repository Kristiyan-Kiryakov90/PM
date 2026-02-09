/**
 * Database RLS Policy Tests
 *
 * Tests Row-Level Security policies for projects, tasks, and attachments.
 * Verifies that:
 * - Company users can CRUD their company's data (all roles, not just admins)
 * - Personal users can CRUD with company_id: null
 * - Data isolation between companies is maintained
 * - Admin and regular users have same permissions within a company
 */

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

test.describe('Database RLS Policies', () => {
  let supabase: any;
  let testCompanyId: string;
  let otherCompanyId: string;
  let adminUser: { id: string; email: string; session: any };
  let regularUser: { id: string; email: string; session: any };
  let otherCompanyUser: { id: string; email: string; session: any };
  let personalUser: { id: string; email: string; session: any };

  test.beforeAll(async () => {
    // Setup test users and companies
    supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Create test company 1
    const company1Email = `admin-${Date.now()}@rls-test.com`;
    const { data: { user: admin }, error: adminError } = await supabase.auth.signUp({
      email: company1Email,
      password: 'TestPass123!',
      options: {
        data: {
          role: 'admin',
          company_name: 'RLS Test Company 1'
        }
      }
    });

    if (adminError || !admin) {
      throw new Error(`Failed to create admin user: ${adminError?.message}`);
    }

    // Sign in as admin to get session
    const { data: { session: adminSession } } = await supabase.auth.signInWithPassword({
      email: company1Email,
      password: 'TestPass123!'
    });

    adminUser = { id: admin.id, email: company1Email, session: adminSession };

    // Get company ID from user metadata
    testCompanyId = admin.user_metadata.company_id;

    // Create regular user in same company
    const regularEmail = `user-${Date.now()}@rls-test.com`;
    const { data: { user: regular }, error: regularError } = await supabase.auth.signUp({
      email: regularEmail,
      password: 'TestPass123!',
      options: {
        data: {
          role: 'user',
          company_id: testCompanyId
        }
      }
    });

    if (regularError || !regular) {
      throw new Error(`Failed to create regular user: ${regularError?.message}`);
    }

    const { data: { session: regularSession } } = await supabase.auth.signInWithPassword({
      email: regularEmail,
      password: 'TestPass123!'
    });

    regularUser = { id: regular.id, email: regularEmail, session: regularSession };

    // Create test company 2
    const company2Email = `other-${Date.now()}@rls-test.com`;
    const { data: { user: other }, error: otherError } = await supabase.auth.signUp({
      email: company2Email,
      password: 'TestPass123!',
      options: {
        data: {
          role: 'admin',
          company_name: 'RLS Test Company 2'
        }
      }
    });

    if (otherError || !other) {
      throw new Error(`Failed to create other company user: ${otherError?.message}`);
    }

    const { data: { session: otherSession } } = await supabase.auth.signInWithPassword({
      email: company2Email,
      password: 'TestPass123!'
    });

    otherCompanyUser = { id: other.id, email: company2Email, session: otherSession };
    otherCompanyId = other.user_metadata.company_id;

    // Create personal user (no company)
    const personalEmail = `personal-${Date.now()}@rls-test.com`;
    const { data: { user: personal }, error: personalError } = await supabase.auth.signUp({
      email: personalEmail,
      password: 'TestPass123!',
      options: {
        data: {
          role: 'user'
          // No company_id or company_name
        }
      }
    });

    if (personalError || !personal) {
      throw new Error(`Failed to create personal user: ${personalError?.message}`);
    }

    const { data: { session: personalSession } } = await supabase.auth.signInWithPassword({
      email: personalEmail,
      password: 'TestPass123!'
    });

    personalUser = { id: personal.id, email: personalEmail, session: personalSession };
  });

  test.afterAll(async () => {
    // Cleanup: Delete test data
    // Note: In production, you'd use a service role key for cleanup
    await supabase.auth.signOut();
  });

  test.describe('Projects RLS Policies', () => {
    test('admin user can create, read, update, delete company projects', async () => {
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${adminUser.session.access_token}` } }
      });

      // Create
      const { data: created, error: createError } = await client
        .from('projects')
        .insert({
          name: 'Admin Project',
          description: 'Created by admin',
          company_id: testCompanyId,
          created_by: adminUser.id
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(created).toBeTruthy();
      expect(created.name).toBe('Admin Project');

      // Read
      const { data: read, error: readError } = await client
        .from('projects')
        .select('*')
        .eq('id', created.id)
        .single();

      expect(readError).toBeNull();
      expect(read.name).toBe('Admin Project');

      // Update
      const { data: updated, error: updateError } = await client
        .from('projects')
        .update({ name: 'Updated Admin Project' })
        .eq('id', created.id)
        .select()
        .single();

      expect(updateError).toBeNull();
      expect(updated.name).toBe('Updated Admin Project');

      // Delete
      const { error: deleteError } = await client
        .from('projects')
        .delete()
        .eq('id', created.id);

      expect(deleteError).toBeNull();
    });

    test('regular user can create, read, update, delete company projects', async () => {
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${regularUser.session.access_token}` } }
      });

      // Create
      const { data: created, error: createError } = await client
        .from('projects')
        .insert({
          name: 'Regular User Project',
          description: 'Created by regular user',
          company_id: testCompanyId,
          created_by: regularUser.id
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(created).toBeTruthy();

      // Update (key test - regular users should be able to update)
      const { data: updated, error: updateError } = await client
        .from('projects')
        .update({ name: 'Updated Regular Project' })
        .eq('id', created.id)
        .select()
        .single();

      expect(updateError).toBeNull();
      expect(updated.name).toBe('Updated Regular Project');

      // Delete (key test - regular users should be able to delete)
      const { error: deleteError } = await client
        .from('projects')
        .delete()
        .eq('id', created.id);

      expect(deleteError).toBeNull();
    });

    test('personal user can create projects with company_id: null', async () => {
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${personalUser.session.access_token}` } }
      });

      const { data: created, error: createError } = await client
        .from('projects')
        .insert({
          name: 'Personal Project',
          description: 'Personal user project',
          company_id: null,
          created_by: personalUser.id
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(created).toBeTruthy();
      expect(created.company_id).toBeNull();

      // Cleanup
      await client.from('projects').delete().eq('id', created.id);
    });

    test('company users cannot see other company projects', async () => {
      const client1 = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${adminUser.session.access_token}` } }
      });

      const client2 = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${otherCompanyUser.session.access_token}` } }
      });

      // Create project in company 1
      const { data: project1 } = await client1
        .from('projects')
        .insert({
          name: 'Company 1 Project',
          company_id: testCompanyId,
          created_by: adminUser.id
        })
        .select()
        .single();

      // Try to read from company 2
      const { data: read, error } = await client2
        .from('projects')
        .select('*')
        .eq('id', project1.id)
        .single();

      expect(read).toBeNull();

      // Cleanup
      await client1.from('projects').delete().eq('id', project1.id);
    });

    test('regular user can update projects created by admin in same company', async () => {
      const adminClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${adminUser.session.access_token}` } }
      });

      const regularClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${regularUser.session.access_token}` } }
      });

      // Admin creates project
      const { data: created } = await adminClient
        .from('projects')
        .insert({
          name: 'Admin Created Project',
          company_id: testCompanyId,
          created_by: adminUser.id
        })
        .select()
        .single();

      // Regular user updates it (should succeed)
      const { data: updated, error: updateError } = await regularClient
        .from('projects')
        .update({ name: 'Updated by Regular User' })
        .eq('id', created.id)
        .select()
        .single();

      expect(updateError).toBeNull();
      expect(updated.name).toBe('Updated by Regular User');

      // Cleanup
      await adminClient.from('projects').delete().eq('id', created.id);
    });
  });

  test.describe('Tasks RLS Policies', () => {
    test('regular user can create tasks with company_id', async () => {
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${regularUser.session.access_token}` } }
      });

      // First create a project
      const { data: project } = await client
        .from('projects')
        .insert({
          name: 'Task Test Project',
          company_id: testCompanyId,
          created_by: regularUser.id
        })
        .select()
        .single();

      // Create task
      const { data: task, error: taskError } = await client
        .from('tasks')
        .insert({
          title: 'Test Task',
          description: 'Task description',
          status: 'todo',
          project_id: project.id,
          company_id: testCompanyId,
          created_by: regularUser.id
        })
        .select()
        .single();

      expect(taskError).toBeNull();
      expect(task).toBeTruthy();
      expect(task.title).toBe('Test Task');

      // Cleanup
      await client.from('tasks').delete().eq('id', task.id);
      await client.from('projects').delete().eq('id', project.id);
    });

    test('personal user can create tasks with company_id: null', async () => {
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${personalUser.session.access_token}` } }
      });

      // Create personal project first
      const { data: project } = await client
        .from('projects')
        .insert({
          name: 'Personal Task Project',
          company_id: null,
          created_by: personalUser.id
        })
        .select()
        .single();

      // Create task with null company_id
      const { data: task, error: taskError } = await client
        .from('tasks')
        .insert({
          title: 'Personal Task',
          description: 'Personal task description',
          status: 'todo',
          project_id: project.id,
          company_id: null,
          created_by: personalUser.id
        })
        .select()
        .single();

      expect(taskError).toBeNull();
      expect(task).toBeTruthy();
      expect(task.company_id).toBeNull();

      // Cleanup
      await client.from('tasks').delete().eq('id', task.id);
      await client.from('projects').delete().eq('id', project.id);
    });

    test('regular user can update and delete tasks in same company', async () => {
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${regularUser.session.access_token}` } }
      });

      // Create project and task
      const { data: project } = await client
        .from('projects')
        .insert({
          name: 'Update Test Project',
          company_id: testCompanyId,
          created_by: regularUser.id
        })
        .select()
        .single();

      const { data: task } = await client
        .from('tasks')
        .insert({
          title: 'Update Test Task',
          status: 'todo',
          project_id: project.id,
          company_id: testCompanyId,
          created_by: regularUser.id
        })
        .select()
        .single();

      // Update
      const { data: updated, error: updateError } = await client
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', task.id)
        .select()
        .single();

      expect(updateError).toBeNull();
      expect(updated.status).toBe('in_progress');

      // Delete
      const { error: deleteError } = await client
        .from('tasks')
        .delete()
        .eq('id', task.id);

      expect(deleteError).toBeNull();

      // Cleanup
      await client.from('projects').delete().eq('id', project.id);
    });

    test('tasks are isolated between companies', async () => {
      const client1 = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${adminUser.session.access_token}` } }
      });

      const client2 = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${otherCompanyUser.session.access_token}` } }
      });

      // Create project and task in company 1
      const { data: project1 } = await client1
        .from('projects')
        .insert({
          name: 'Isolation Test Project',
          company_id: testCompanyId,
          created_by: adminUser.id
        })
        .select()
        .single();

      const { data: task1 } = await client1
        .from('tasks')
        .insert({
          title: 'Company 1 Task',
          status: 'todo',
          project_id: project1.id,
          company_id: testCompanyId,
          created_by: adminUser.id
        })
        .select()
        .single();

      // Try to read from company 2
      const { data: read } = await client2
        .from('tasks')
        .select('*')
        .eq('id', task1.id)
        .single();

      expect(read).toBeNull();

      // Cleanup
      await client1.from('tasks').delete().eq('id', task1.id);
      await client1.from('projects').delete().eq('id', project1.id);
    });
  });

  test.describe('Attachments RLS Policies', () => {
    test('regular user can create attachments with company_id', async () => {
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${regularUser.session.access_token}` } }
      });

      // Create project and task
      const { data: project } = await client
        .from('projects')
        .insert({
          name: 'Attachment Test Project',
          company_id: testCompanyId,
          created_by: regularUser.id
        })
        .select()
        .single();

      const { data: task } = await client
        .from('tasks')
        .insert({
          title: 'Attachment Test Task',
          status: 'todo',
          project_id: project.id,
          company_id: testCompanyId,
          created_by: regularUser.id
        })
        .select()
        .single();

      // Create attachment
      const { data: attachment, error: attachError } = await client
        .from('attachments')
        .insert({
          task_id: task.id,
          file_name: 'test.pdf',
          file_path: 'path/to/test.pdf',
          file_size: 1024,
          mime_type: 'application/pdf',
          company_id: testCompanyId,
          created_by: regularUser.id
        })
        .select()
        .single();

      expect(attachError).toBeNull();
      expect(attachment).toBeTruthy();

      // Cleanup
      await client.from('attachments').delete().eq('id', attachment.id);
      await client.from('tasks').delete().eq('id', task.id);
      await client.from('projects').delete().eq('id', project.id);
    });

    test('personal user can create attachments with company_id: null', async () => {
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${personalUser.session.access_token}` } }
      });

      // Create personal project and task
      const { data: project } = await client
        .from('projects')
        .insert({
          name: 'Personal Attachment Project',
          company_id: null,
          created_by: personalUser.id
        })
        .select()
        .single();

      const { data: task } = await client
        .from('tasks')
        .insert({
          title: 'Personal Attachment Task',
          status: 'todo',
          project_id: project.id,
          company_id: null,
          created_by: personalUser.id
        })
        .select()
        .single();

      // Create attachment with null company_id
      const { data: attachment, error: attachError } = await client
        .from('attachments')
        .insert({
          task_id: task.id,
          file_name: 'personal.pdf',
          file_path: 'path/to/personal.pdf',
          file_size: 2048,
          mime_type: 'application/pdf',
          company_id: null,
          created_by: personalUser.id
        })
        .select()
        .single();

      expect(attachError).toBeNull();
      expect(attachment).toBeTruthy();
      expect(attachment.company_id).toBeNull();

      // Cleanup
      await client.from('attachments').delete().eq('id', attachment.id);
      await client.from('tasks').delete().eq('id', task.id);
      await client.from('projects').delete().eq('id', project.id);
    });
  });
});
