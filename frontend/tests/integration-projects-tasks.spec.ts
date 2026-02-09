/**
 * Integration Tests: Projects and Tasks End-to-End Workflows
 *
 * Tests complete user workflows including:
 * - Create project → Add tasks → Update → Delete
 * - Cascade delete behavior
 * - Multi-project scenarios
 * - Edge cases and data validation
 */

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

test.describe('Projects and Tasks Integration', () => {
  let supabase: any;
  let testUser: { id: string; email: string; session: any; companyId: string };

  test.beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Create test user
    const email = `integration-${Date.now()}@test.com`;
    const { data: { user }, error } = await supabase.auth.signUp({
      email,
      password: 'TestPass123!',
      options: {
        data: {
          role: 'user',
          company_name: 'Integration Test Company'
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

  test('complete workflow: create project → add tasks → update → delete', async () => {
    const client = getAuthenticatedClient();

    // Step 1: Create project
    const { data: project, error: projectError } = await client
      .from('projects')
      .insert({
        name: 'Workflow Test Project',
        description: 'Testing complete workflow',
        company_id: testUser.companyId,
        created_by: testUser.id
      })
      .select()
      .single();

    expect(projectError).toBeNull();
    expect(project).toBeTruthy();
    expect(project.name).toBe('Workflow Test Project');

    // Step 2: Add multiple tasks
    const tasksToCreate = [
      { title: 'Task 1', status: 'todo' },
      { title: 'Task 2', status: 'in_progress' },
      { title: 'Task 3', status: 'done' }
    ];

    const createdTasks = [];
    for (const taskData of tasksToCreate) {
      const { data: task, error: taskError } = await client
        .from('tasks')
        .insert({
          ...taskData,
          project_id: project.id,
          company_id: testUser.companyId,
          created_by: testUser.id
        })
        .select()
        .single();

      expect(taskError).toBeNull();
      expect(task).toBeTruthy();
      createdTasks.push(task);
    }

    expect(createdTasks).toHaveLength(3);

    // Step 3: Verify tasks are associated with project
    const { data: projectTasks, error: tasksError } = await client
      .from('tasks')
      .select('*')
      .eq('project_id', project.id);

    expect(tasksError).toBeNull();
    expect(projectTasks).toHaveLength(3);

    // Step 4: Update project
    const { data: updatedProject, error: updateError } = await client
      .from('projects')
      .update({ name: 'Updated Workflow Project' })
      .eq('id', project.id)
      .select()
      .single();

    expect(updateError).toBeNull();
    expect(updatedProject.name).toBe('Updated Workflow Project');

    // Step 5: Update a task
    const { data: updatedTask, error: taskUpdateError } = await client
      .from('tasks')
      .update({ status: 'done' })
      .eq('id', createdTasks[0].id)
      .select()
      .single();

    expect(taskUpdateError).toBeNull();
    expect(updatedTask.status).toBe('done');

    // Step 6: Delete individual task
    const { error: taskDeleteError } = await client
      .from('tasks')
      .delete()
      .eq('id', createdTasks[0].id);

    expect(taskDeleteError).toBeNull();

    // Verify task deleted
    const { data: remainingTasks } = await client
      .from('tasks')
      .select('*')
      .eq('project_id', project.id);

    expect(remainingTasks).toHaveLength(2);

    // Step 7: Delete project (should cascade delete remaining tasks)
    const { error: projectDeleteError } = await client
      .from('projects')
      .delete()
      .eq('id', project.id);

    expect(projectDeleteError).toBeNull();

    // Verify all tasks deleted
    const { data: allTasks } = await client
      .from('tasks')
      .select('*')
      .eq('project_id', project.id);

    expect(allTasks).toHaveLength(0);
  });

  test('cascade delete: deleting project removes all associated tasks', async () => {
    const client = getAuthenticatedClient();

    // Create project
    const { data: project } = await client
      .from('projects')
      .insert({
        name: 'Cascade Test Project',
        company_id: testUser.companyId,
        created_by: testUser.id
      })
      .select()
      .single();

    // Create 5 tasks
    const taskPromises = Array.from({ length: 5 }, (_, i) =>
      client.from('tasks').insert({
        title: `Cascade Task ${i + 1}`,
        status: 'todo',
        project_id: project.id,
        company_id: testUser.companyId,
        created_by: testUser.id
      }).select().single()
    );

    await Promise.all(taskPromises);

    // Verify 5 tasks exist
    const { data: beforeDelete } = await client
      .from('tasks')
      .select('*')
      .eq('project_id', project.id);

    expect(beforeDelete).toHaveLength(5);

    // Delete project
    await client.from('projects').delete().eq('id', project.id);

    // Verify all tasks deleted
    const { data: afterDelete } = await client
      .from('tasks')
      .select('*')
      .eq('project_id', project.id);

    expect(afterDelete).toHaveLength(0);
  });

  test('multi-project scenario: tasks correctly associated with projects', async () => {
    const client = getAuthenticatedClient();

    // Create 3 projects
    const { data: project1 } = await client
      .from('projects')
      .insert({
        name: 'Multi Project 1',
        company_id: testUser.companyId,
        created_by: testUser.id
      })
      .select()
      .single();

    const { data: project2 } = await client
      .from('projects')
      .insert({
        name: 'Multi Project 2',
        company_id: testUser.companyId,
        created_by: testUser.id
      })
      .select()
      .single();

    const { data: project3 } = await client
      .from('projects')
      .insert({
        name: 'Multi Project 3',
        company_id: testUser.companyId,
        created_by: testUser.id
      })
      .select()
      .single();

    // Add tasks to each project
    await client.from('tasks').insert([
      {
        title: 'P1 Task 1',
        status: 'todo',
        project_id: project1.id,
        company_id: testUser.companyId,
        created_by: testUser.id
      },
      {
        title: 'P1 Task 2',
        status: 'todo',
        project_id: project1.id,
        company_id: testUser.companyId,
        created_by: testUser.id
      },
      {
        title: 'P2 Task 1',
        status: 'todo',
        project_id: project2.id,
        company_id: testUser.companyId,
        created_by: testUser.id
      },
      {
        title: 'P3 Task 1',
        status: 'todo',
        project_id: project3.id,
        company_id: testUser.companyId,
        created_by: testUser.id
      },
      {
        title: 'P3 Task 2',
        status: 'todo',
        project_id: project3.id,
        company_id: testUser.companyId,
        created_by: testUser.id
      },
      {
        title: 'P3 Task 3',
        status: 'todo',
        project_id: project3.id,
        company_id: testUser.companyId,
        created_by: testUser.id
      }
    ]);

    // Verify task counts per project
    const { data: p1Tasks } = await client
      .from('tasks')
      .select('*')
      .eq('project_id', project1.id);
    expect(p1Tasks).toHaveLength(2);

    const { data: p2Tasks } = await client
      .from('tasks')
      .select('*')
      .eq('project_id', project2.id);
    expect(p2Tasks).toHaveLength(1);

    const { data: p3Tasks } = await client
      .from('tasks')
      .select('*')
      .eq('project_id', project3.id);
    expect(p3Tasks).toHaveLength(3);

    // Delete project 2
    await client.from('projects').delete().eq('id', project2.id);

    // Verify project 2 tasks deleted, others remain
    const { data: p2AfterDelete } = await client
      .from('tasks')
      .select('*')
      .eq('project_id', project2.id);
    expect(p2AfterDelete).toHaveLength(0);

    const { data: p1AfterDelete } = await client
      .from('tasks')
      .select('*')
      .eq('project_id', project1.id);
    expect(p1AfterDelete).toHaveLength(2);

    const { data: p3AfterDelete } = await client
      .from('tasks')
      .select('*')
      .eq('project_id', project3.id);
    expect(p3AfterDelete).toHaveLength(3);

    // Cleanup
    await client.from('projects').delete().in('id', [project1.id, project3.id]);
  });

  test('edge case: project with empty description', async () => {
    const client = getAuthenticatedClient();

    const { data: project, error } = await client
      .from('projects')
      .insert({
        name: 'No Description Project',
        description: '',
        company_id: testUser.companyId,
        created_by: testUser.id
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(project.description).toBe('');

    await client.from('projects').delete().eq('id', project.id);
  });

  test('edge case: task with special characters in title', async () => {
    const client = getAuthenticatedClient();

    const { data: project } = await client
      .from('projects')
      .insert({
        name: 'Special Chars Project',
        company_id: testUser.companyId,
        created_by: testUser.id
      })
      .select()
      .single();

    const specialTitle = "Task with \"quotes\" & <tags> and 'apostrophes'";

    const { data: task, error } = await client
      .from('tasks')
      .insert({
        title: specialTitle,
        status: 'todo',
        project_id: project.id,
        company_id: testUser.companyId,
        created_by: testUser.id
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(task.title).toBe(specialTitle);

    await client.from('projects').delete().eq('id', project.id);
  });

  test('edge case: very long project name', async () => {
    const client = getAuthenticatedClient();

    const longName = 'A'.repeat(255); // Assuming 255 char limit

    const { data: project, error } = await client
      .from('projects')
      .insert({
        name: longName,
        company_id: testUser.companyId,
        created_by: testUser.id
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(project.name).toBe(longName);

    await client.from('projects').delete().eq('id', project.id);
  });

  test('data validation: cannot create project with empty name', async () => {
    const client = getAuthenticatedClient();

    const { data, error } = await client
      .from('projects')
      .insert({
        name: '',
        company_id: testUser.companyId,
        created_by: testUser.id
      })
      .select()
      .single();

    // Should fail due to validation or constraint
    expect(error).toBeTruthy();
  });

  test('data validation: cannot create task with invalid project_id', async () => {
    const client = getAuthenticatedClient();

    const fakeProjectId = '00000000-0000-0000-0000-000000000000';

    const { data, error } = await client
      .from('tasks')
      .insert({
        title: 'Invalid Project Task',
        status: 'todo',
        project_id: fakeProjectId,
        company_id: testUser.companyId,
        created_by: testUser.id
      })
      .select()
      .single();

    // Should fail due to foreign key constraint
    expect(error).toBeTruthy();
  });

  test('tasks appear immediately after creation', async () => {
    const client = getAuthenticatedClient();

    const { data: project } = await client
      .from('projects')
      .insert({
        name: 'Immediate Test Project',
        company_id: testUser.companyId,
        created_by: testUser.id
      })
      .select()
      .single();

    // Create task
    const { data: createdTask } = await client
      .from('tasks')
      .insert({
        title: 'Immediate Task',
        status: 'todo',
        project_id: project.id,
        company_id: testUser.companyId,
        created_by: testUser.id
      })
      .select()
      .single();

    // Immediately query for it
    const { data: queriedTask } = await client
      .from('tasks')
      .select('*')
      .eq('id', createdTask.id)
      .single();

    expect(queriedTask).toBeTruthy();
    expect(queriedTask.id).toBe(createdTask.id);
    expect(queriedTask.title).toBe('Immediate Task');

    await client.from('projects').delete().eq('id', project.id);
  });

  test('updating task status preserves other fields', async () => {
    const client = getAuthenticatedClient();

    const { data: project } = await client
      .from('projects')
      .insert({
        name: 'Status Update Project',
        company_id: testUser.companyId,
        created_by: testUser.id
      })
      .select()
      .single();

    const { data: task } = await client
      .from('tasks')
      .insert({
        title: 'Status Update Task',
        description: 'Original description',
        status: 'todo',
        priority: 'high',
        project_id: project.id,
        company_id: testUser.companyId,
        created_by: testUser.id
      })
      .select()
      .single();

    // Update only status
    const { data: updated } = await client
      .from('tasks')
      .update({ status: 'in_progress' })
      .eq('id', task.id)
      .select()
      .single();

    expect(updated.status).toBe('in_progress');
    expect(updated.title).toBe('Status Update Task');
    expect(updated.description).toBe('Original description');
    expect(updated.priority).toBe('high');

    await client.from('projects').delete().eq('id', project.id);
  });

  test('personal user workflow: create project and tasks with null company_id', async () => {
    // Create a personal user (no company)
    const personalEmail = `personal-integration-${Date.now()}@test.com`;
    const { data: { user: personalUser } } = await supabase.auth.signUp({
      email: personalEmail,
      password: 'TestPass123!',
      options: {
        data: { role: 'user' }
      }
    });

    const { data: { session: personalSession } } = await supabase.auth.signInWithPassword({
      email: personalEmail,
      password: 'TestPass123!'
    });

    const personalClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${personalSession.access_token}` } }
    });

    // Create personal project
    const { data: project, error: projectError } = await personalClient
      .from('projects')
      .insert({
        name: 'Personal Project',
        description: 'Personal user project',
        company_id: null,
        created_by: personalUser.id
      })
      .select()
      .single();

    expect(projectError).toBeNull();
    expect(project.company_id).toBeNull();

    // Create personal tasks
    const { data: task, error: taskError } = await personalClient
      .from('tasks')
      .insert({
        title: 'Personal Task',
        status: 'todo',
        project_id: project.id,
        company_id: null,
        created_by: personalUser.id
      })
      .select()
      .single();

    expect(taskError).toBeNull();
    expect(task.company_id).toBeNull();

    // Verify task appears
    const { data: tasks } = await personalClient
      .from('tasks')
      .select('*')
      .eq('project_id', project.id);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe(task.id);

    // Cleanup
    await personalClient.from('projects').delete().eq('id', project.id);
    await supabase.auth.signOut();
  });
});
