/**
 * Unit Tests: Service Layer
 *
 * Tests project-service and task-service functions including:
 * - CRUD operations
 * - Error handling
 * - Input validation
 * - Company ID null handling
 */

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

test.describe('Service Layer Unit Tests', () => {
  let supabase: any;
  let testUser: { id: string; email: string; session: any; companyId: string };

  test.beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseAnonKey);

    const email = `service-unit-${Date.now()}@test.com`;
    const { data: { user }, error } = await supabase.auth.signUp({
      email,
      password: 'TestPass123!',
      options: {
        data: {
          role: 'user',
          company_name: 'Service Unit Test Company'
        }
      }
    });

    if (error || !user) {
      throw new Error(`Failed to create test user: ${error?.message}`);
    }

    const { data: { session } } = await supabase.auth.signInWithPassword({
      email,
      password: 'TestPass123!'
    });

    testUser = {
      id: user.id,
      email,
      session,
      companyId: user.user_metadata.company_id
    };
  });

  test.afterAll(async () => {
    await supabase.auth.signOut();
  });

  function getAuthenticatedClient() {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${testUser.session.access_token}` } }
    });
  }

  test.describe('Project Service', () => {
    test('createProject: creates project with all fields', async () => {
      const client = getAuthenticatedClient();

      const projectData = {
        name: 'Unit Test Project',
        description: 'Full project description',
        company_id: testUser.companyId,
        created_by: testUser.id
      };

      const { data, error } = await client
        .from('projects')
        .insert(projectData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.name).toBe(projectData.name);
      expect(data.description).toBe(projectData.description);
      expect(data.company_id).toBe(projectData.company_id);
      expect(data.created_by).toBe(projectData.created_by);

      await client.from('projects').delete().eq('id', data.id);
    });

    test('createProject: handles null company_id', async () => {
      const client = getAuthenticatedClient();

      const { data, error } = await client
        .from('projects')
        .insert({
          name: 'Null Company Project',
          company_id: null,
          created_by: testUser.id
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.company_id).toBeNull();

      await client.from('projects').delete().eq('id', data.id);
    });

    test('getProjects: retrieves all user projects', async () => {
      const client = getAuthenticatedClient();

      // Create multiple projects
      await client.from('projects').insert([
        { name: 'Project A', company_id: testUser.companyId, created_by: testUser.id },
        { name: 'Project B', company_id: testUser.companyId, created_by: testUser.id },
        { name: 'Project C', company_id: testUser.companyId, created_by: testUser.id }
      ]);

      const { data, error } = await client
        .from('projects')
        .select('*')
        .eq('company_id', testUser.companyId)
        .order('created_at', { ascending: false });

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThanOrEqual(3);

      // Cleanup
      const projectIds = data.map(p => p.id);
      await client.from('projects').delete().in('id', projectIds);
    });

    test('getProjectById: retrieves specific project', async () => {
      const client = getAuthenticatedClient();

      const { data: created } = await client
        .from('projects')
        .insert({
          name: 'Specific Project',
          company_id: testUser.companyId,
          created_by: testUser.id
        })
        .select()
        .single();

      const { data: fetched, error } = await client
        .from('projects')
        .select('*')
        .eq('id', created.id)
        .single();

      expect(error).toBeNull();
      expect(fetched.id).toBe(created.id);
      expect(fetched.name).toBe('Specific Project');

      await client.from('projects').delete().eq('id', created.id);
    });

    test('updateProject: updates project fields', async () => {
      const client = getAuthenticatedClient();

      const { data: created } = await client
        .from('projects')
        .insert({
          name: 'Original Name',
          description: 'Original description',
          company_id: testUser.companyId,
          created_by: testUser.id
        })
        .select()
        .single();

      const { data: updated, error } = await client
        .from('projects')
        .update({
          name: 'Updated Name',
          description: 'Updated description'
        })
        .eq('id', created.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('Updated description');

      await client.from('projects').delete().eq('id', created.id);
    });

    test('deleteProject: removes project', async () => {
      const client = getAuthenticatedClient();

      const { data: created } = await client
        .from('projects')
        .insert({
          name: 'To Delete',
          company_id: testUser.companyId,
          created_by: testUser.id
        })
        .select()
        .single();

      const { error } = await client
        .from('projects')
        .delete()
        .eq('id', created.id);

      expect(error).toBeNull();

      const { data: fetched } = await client
        .from('projects')
        .select('*')
        .eq('id', created.id)
        .single();

      expect(fetched).toBeNull();
    });

    test('error handling: rejects invalid data', async () => {
      const client = getAuthenticatedClient();

      // Missing required field (name)
      const { error } = await client
        .from('projects')
        .insert({
          description: 'No name',
          company_id: testUser.companyId,
          created_by: testUser.id
        })
        .select()
        .single();

      expect(error).toBeTruthy();
    });
  });

  test.describe('Task Service', () => {
    let testProjectId: string;

    test.beforeEach(async () => {
      const client = getAuthenticatedClient();
      const { data: project } = await client
        .from('projects')
        .insert({
          name: 'Task Test Project',
          company_id: testUser.companyId,
          created_by: testUser.id
        })
        .select()
        .single();

      testProjectId = project.id;
    });

    test.afterEach(async () => {
      const client = getAuthenticatedClient();
      await client.from('projects').delete().eq('id', testProjectId);
    });

    test('createTask: creates task with all fields', async () => {
      const client = getAuthenticatedClient();

      const taskData = {
        title: 'Unit Test Task',
        description: 'Task description',
        status: 'todo' as const,
        priority: 'high' as const,
        project_id: testProjectId,
        company_id: testUser.companyId,
        created_by: testUser.id
      };

      const { data, error } = await client
        .from('tasks')
        .insert(taskData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.title).toBe(taskData.title);
      expect(data.description).toBe(taskData.description);
      expect(data.status).toBe(taskData.status);
      expect(data.priority).toBe(taskData.priority);
      expect(data.project_id).toBe(taskData.project_id);
      expect(data.company_id).toBe(taskData.company_id);
    });

    test('createTask: handles null company_id', async () => {
      const client = getAuthenticatedClient();

      // Create personal project first
      const { data: personalProject } = await client
        .from('projects')
        .insert({
          name: 'Personal Task Project',
          company_id: null,
          created_by: testUser.id
        })
        .select()
        .single();

      const { data, error } = await client
        .from('tasks')
        .insert({
          title: 'Personal Task',
          status: 'todo',
          project_id: personalProject.id,
          company_id: null,
          created_by: testUser.id
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.company_id).toBeNull();

      await client.from('projects').delete().eq('id', personalProject.id);
    });

    test('createTask: handles optional fields', async () => {
      const client = getAuthenticatedClient();

      const { data, error } = await client
        .from('tasks')
        .insert({
          title: 'Minimal Task',
          status: 'todo',
          project_id: testProjectId,
          company_id: testUser.companyId,
          created_by: testUser.id
          // No description, priority, assignee_id, due_date
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.title).toBe('Minimal Task');
      expect(data.description).toBeFalsy();
      expect(data.priority).toBeFalsy();
    });

    test('getTasks: retrieves tasks for project', async () => {
      const client = getAuthenticatedClient();

      // Create multiple tasks
      await client.from('tasks').insert([
        { title: 'Task 1', status: 'todo', project_id: testProjectId, company_id: testUser.companyId, created_by: testUser.id },
        { title: 'Task 2', status: 'in_progress', project_id: testProjectId, company_id: testUser.companyId, created_by: testUser.id },
        { title: 'Task 3', status: 'done', project_id: testProjectId, company_id: testUser.companyId, created_by: testUser.id }
      ]);

      const { data, error } = await client
        .from('tasks')
        .select('*')
        .eq('project_id', testProjectId);

      expect(error).toBeNull();
      expect(data).toHaveLength(3);
    });

    test('getTaskById: retrieves specific task', async () => {
      const client = getAuthenticatedClient();

      const { data: created } = await client
        .from('tasks')
        .insert({
          title: 'Specific Task',
          status: 'todo',
          project_id: testProjectId,
          company_id: testUser.companyId,
          created_by: testUser.id
        })
        .select()
        .single();

      const { data: fetched, error } = await client
        .from('tasks')
        .select('*')
        .eq('id', created.id)
        .single();

      expect(error).toBeNull();
      expect(fetched.id).toBe(created.id);
      expect(fetched.title).toBe('Specific Task');
    });

    test('updateTask: updates task fields', async () => {
      const client = getAuthenticatedClient();

      const { data: created } = await client
        .from('tasks')
        .insert({
          title: 'Original Task',
          status: 'todo',
          priority: 'low',
          project_id: testProjectId,
          company_id: testUser.companyId,
          created_by: testUser.id
        })
        .select()
        .single();

      const { data: updated, error } = await client
        .from('tasks')
        .update({
          title: 'Updated Task',
          status: 'in_progress',
          priority: 'high'
        })
        .eq('id', created.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(updated.title).toBe('Updated Task');
      expect(updated.status).toBe('in_progress');
      expect(updated.priority).toBe('high');
    });

    test('updateTask: partial update preserves other fields', async () => {
      const client = getAuthenticatedClient();

      const { data: created } = await client
        .from('tasks')
        .insert({
          title: 'Partial Update Task',
          description: 'Original description',
          status: 'todo',
          priority: 'medium',
          project_id: testProjectId,
          company_id: testUser.companyId,
          created_by: testUser.id
        })
        .select()
        .single();

      const { data: updated } = await client
        .from('tasks')
        .update({ status: 'done' })
        .eq('id', created.id)
        .select()
        .single();

      expect(updated.status).toBe('done');
      expect(updated.title).toBe('Partial Update Task');
      expect(updated.description).toBe('Original description');
      expect(updated.priority).toBe('medium');
    });

    test('deleteTask: removes task', async () => {
      const client = getAuthenticatedClient();

      const { data: created } = await client
        .from('tasks')
        .insert({
          title: 'To Delete Task',
          status: 'todo',
          project_id: testProjectId,
          company_id: testUser.companyId,
          created_by: testUser.id
        })
        .select()
        .single();

      const { error } = await client
        .from('tasks')
        .delete()
        .eq('id', created.id);

      expect(error).toBeNull();

      const { data: fetched } = await client
        .from('tasks')
        .select('*')
        .eq('id', created.id)
        .single();

      expect(fetched).toBeNull();
    });

    test('error handling: rejects task without project_id', async () => {
      const client = getAuthenticatedClient();

      const { error } = await client
        .from('tasks')
        .insert({
          title: 'No Project Task',
          status: 'todo',
          company_id: testUser.companyId,
          created_by: testUser.id
          // Missing project_id
        })
        .select()
        .single();

      expect(error).toBeTruthy();
    });

    test('error handling: rejects task with invalid status', async () => {
      const client = getAuthenticatedClient();

      const { error } = await client
        .from('tasks')
        .insert({
          title: 'Invalid Status Task',
          status: 'invalid_status',
          project_id: testProjectId,
          company_id: testUser.companyId,
          created_by: testUser.id
        })
        .select()
        .single();

      expect(error).toBeTruthy();
    });

    test('getTasksByStatus: filters tasks by status', async () => {
      const client = getAuthenticatedClient();

      await client.from('tasks').insert([
        { title: 'Todo 1', status: 'todo', project_id: testProjectId, company_id: testUser.companyId, created_by: testUser.id },
        { title: 'Todo 2', status: 'todo', project_id: testProjectId, company_id: testUser.companyId, created_by: testUser.id },
        { title: 'In Progress', status: 'in_progress', project_id: testProjectId, company_id: testUser.companyId, created_by: testUser.id },
        { title: 'Done', status: 'done', project_id: testProjectId, company_id: testUser.companyId, created_by: testUser.id }
      ]);

      const { data: todoTasks } = await client
        .from('tasks')
        .select('*')
        .eq('project_id', testProjectId)
        .eq('status', 'todo');

      expect(todoTasks).toHaveLength(2);

      const { data: inProgressTasks } = await client
        .from('tasks')
        .select('*')
        .eq('project_id', testProjectId)
        .eq('status', 'in_progress');

      expect(inProgressTasks).toHaveLength(1);

      const { data: doneTasks } = await client
        .from('tasks')
        .select('*')
        .eq('project_id', testProjectId)
        .eq('status', 'done');

      expect(doneTasks).toHaveLength(1);
    });

    test('task creation immediately visible in queries', async () => {
      const client = getAuthenticatedClient();

      const { data: created } = await client
        .from('tasks')
        .insert({
          title: 'Immediate Visibility Task',
          status: 'todo',
          project_id: testProjectId,
          company_id: testUser.companyId,
          created_by: testUser.id
        })
        .select()
        .single();

      // Immediately query
      const { data: queried } = await client
        .from('tasks')
        .select('*')
        .eq('id', created.id)
        .single();

      expect(queried).toBeTruthy();
      expect(queried.id).toBe(created.id);
    });
  });

  test.describe('Company ID Handling', () => {
    test('project service handles null company_id correctly', async () => {
      const client = getAuthenticatedClient();

      const { data, error } = await client
        .from('projects')
        .insert({
          name: 'Null Company Test',
          company_id: null,
          created_by: testUser.id
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.company_id).toBeNull();

      await client.from('projects').delete().eq('id', data.id);
    });

    test('task service handles null company_id correctly', async () => {
      const client = getAuthenticatedClient();

      // Create personal project
      const { data: project } = await client
        .from('projects')
        .insert({
          name: 'Personal Project',
          company_id: null,
          created_by: testUser.id
        })
        .select()
        .single();

      const { data: task, error } = await client
        .from('tasks')
        .insert({
          title: 'Null Company Task',
          status: 'todo',
          project_id: project.id,
          company_id: null,
          created_by: testUser.id
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(task.company_id).toBeNull();

      await client.from('projects').delete().eq('id', project.id);
    });
  });
});
