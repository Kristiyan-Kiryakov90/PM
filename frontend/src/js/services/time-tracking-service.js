/**
 * Time Tracking Service
 * Manages time entries, timers, and time aggregation
 * Phase 3A: Time Tracking
 */

import supabase from './supabase.js';
import { getCurrentUser } from '../utils/auth.js';

/**
 * Start a timer for a task
 * @param {number} taskId - Task ID
 * @param {string} description - Optional description
 * @returns {Promise<Object>} Created time entry
 */
export async function startTimer(taskId, description = null) {
  const user = await getCurrentUser();

  // Check if user already has an active timer
  const activeTimer = await getActiveTimer();
  if (activeTimer) {
    throw new Error(
      `You already have an active timer running for "${activeTimer.task_title}". Stop it before starting a new one.`
    );
  }

  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      task_id: taskId,
      user_id: user.id,
      company_id: user.user_metadata?.company_id || null,
      description,
      is_manual: false,
    })
    .select('*, tasks(id, title)')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Stop the currently running timer
 * @param {number} entryId - Time entry ID
 * @returns {Promise<Object>} Updated time entry with duration
 */
export async function stopTimer(entryId) {
  const { data, error } = await supabase
    .from('time_entries')
    .update({
      end_time: new Date().toISOString(),
    })
    .eq('id', entryId)
    .select('*, tasks(id, title)')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get the current user's active timer (if any)
 * @returns {Promise<Object|null>} Active timer or null
 */
export async function getActiveTimer() {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('time_entries')
    .select('*, tasks(id, title)')
    .eq('user_id', user.id)
    .is('end_time', null)
    .single();

  if (error) {
    // No active timer found
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}

/**
 * Create a manual time entry
 * @param {number} taskId - Task ID
 * @param {string} startTime - Start time (ISO string)
 * @param {string} endTime - End time (ISO string)
 * @param {string} description - Optional description
 * @returns {Promise<Object>} Created time entry
 */
export async function createManualEntry(taskId, startTime, endTime, description = null) {
  const user = await getCurrentUser();

  // Validate times
  if (new Date(endTime) <= new Date(startTime)) {
    throw new Error('End time must be after start time');
  }

  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      task_id: taskId,
      user_id: user.id,
      company_id: user.user_metadata?.company_id || null,
      start_time: startTime,
      end_time: endTime,
      description,
      is_manual: true,
    })
    .select('*, tasks(id, title)')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a time entry
 * @param {number} entryId - Time entry ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated time entry
 */
export async function updateTimeEntry(entryId, updates) {
  // Validate times if both are provided
  if (updates.start_time && updates.end_time) {
    if (new Date(updates.end_time) <= new Date(updates.start_time)) {
      throw new Error('End time must be after start time');
    }
  }

  const { data, error } = await supabase
    .from('time_entries')
    .update(updates)
    .eq('id', entryId)
    .select('*, tasks(id, title)')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a time entry
 * @param {number} entryId - Time entry ID
 * @returns {Promise<void>}
 */
export async function deleteTimeEntry(entryId) {
  const { error } = await supabase.from('time_entries').delete().eq('id', entryId);

  if (error) throw error;
}

/**
 * Get all time entries for a task
 * @param {number} taskId - Task ID
 * @returns {Promise<Array>} Time entries
 */
export async function getTaskTimeEntries(taskId) {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*, tasks(id, title)')
    .eq('task_id', taskId)
    .order('start_time', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get time entries for current user with filters
 * @param {Object} filters - { task_id, start_date, end_date }
 * @returns {Promise<Array>} Time entries
 */
export async function getUserTimeEntries(filters = {}) {
  const user = await getCurrentUser();

  let query = supabase
    .from('time_entries')
    .select('*, tasks(id, title, projects(id, name))')
    .eq('user_id', user.id);

  if (filters.task_id) {
    query = query.eq('task_id', filters.task_id);
  }

  if (filters.start_date) {
    query = query.gte('start_time', filters.start_date);
  }

  if (filters.end_date) {
    query = query.lte('start_time', filters.end_date);
  }

  query = query.order('start_time', { ascending: false });

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Get total time tracked for a task (in seconds)
 * @param {number} taskId - Task ID
 * @returns {Promise<number>} Total seconds
 */
export async function getTaskTotalTime(taskId) {
  const { data, error } = await supabase.rpc('get_task_total_time', {
    p_task_id: taskId,
  });

  if (error) throw error;
  return data || 0;
}

/**
 * Get total time tracked by user in date range (in seconds)
 * @param {string} startDate - Start date (ISO string)
 * @param {string} endDate - End date (ISO string)
 * @returns {Promise<number>} Total seconds
 */
export async function getUserTotalTime(startDate = null, endDate = null) {
  const user = await getCurrentUser();

  const { data, error } = await supabase.rpc('get_user_total_time', {
    p_user_id: user.id,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) throw error;
  return data || 0;
}

/**
 * Format duration in seconds to HH:MM:SS
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '00:00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return [hours, minutes, secs].map((val) => String(val).padStart(2, '0')).join(':');
}

/**
 * Format duration in seconds to human-readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration (e.g., "2h 30m", "45m", "30s")
 */
export function formatDurationHuman(seconds) {
  if (!seconds || seconds < 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 && hours === 0) parts.push(`${secs}s`); // Only show seconds if less than 1 hour

  return parts.join(' ') || '0s';
}

/**
 * Calculate elapsed seconds from start time to now
 * @param {string} startTime - Start time (ISO string)
 * @returns {number} Elapsed seconds
 */
export function getElapsedSeconds(startTime) {
  const start = new Date(startTime);
  const now = new Date();
  return Math.floor((now - start) / 1000);
}

/**
 * Subscribe to time entries for a task
 * @param {number} taskId - Task ID
 * @param {Function} callback - Called when time entries change
 * @returns {Object} Subscription object with unsubscribe method
 */
export function subscribeToTaskTimeEntries(taskId, callback) {
  const subscription = supabase
    .channel(`time_entries:task_${taskId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'time_entries',
        filter: `task_id=eq.${taskId}`,
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(subscription);
    },
  };
}

/**
 * Subscribe to user's active timer
 * @param {Function} callback - Called when active timer changes
 * @returns {Object} Subscription object with unsubscribe method
 */
export async function subscribeToActiveTimer(callback) {
  const user = await getCurrentUser();

  const subscription = supabase
    .channel(`time_entries:user_${user.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'time_entries',
        filter: `user_id=eq.${user.id}`,
      },
      async (payload) => {
        // Check if this affects the active timer (end_time is NULL)
        if (
          payload.eventType === 'INSERT' ||
          (payload.eventType === 'UPDATE' &&
            (payload.new.end_time === null || payload.old?.end_time === null))
        ) {
          const activeTimer = await getActiveTimer();
          callback(activeTimer);
        } else if (payload.eventType === 'DELETE' && payload.old.end_time === null) {
          callback(null);
        }
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(subscription);
    },
  };
}
