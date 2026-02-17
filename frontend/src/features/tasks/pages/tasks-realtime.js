/**
 * Tasks Page - Real-time Module
 * Handles real-time subscriptions and updates
 */

import { realtimeService } from '@services/realtime-service.js';

let realtimeSubscriptionId = null;
let recentLocalUpdates = new Set(); // Track recent local updates to prevent reload loops
let reloadDebounceTimer = null;

/**
 * Setup realtime subscription
 */
export async function setupRealtimeSubscription(ignoreRealtimeUpdates, debouncedReloadTasks) {
  try {
    console.log('📡 Setting up tasks realtime subscription...');
    realtimeSubscriptionId = await realtimeService.subscribeToTasks(
      // On insert
      (newTask) => {
        console.log('📡 Real-time: New task added:', newTask.id, newTask.title);
        debouncedReloadTasks();
      },
      // On update
      (updatedTask, oldTask) => {
        console.log('📡 Real-time: Task updated:', updatedTask.id, updatedTask.title);

        // Ignore real-time updates during manual operations
        if (ignoreRealtimeUpdates()) {
          console.log('⏭️ Ignoring real-time update during manual operation');
          return;
        }

        // Check if this was a local update (from drag-and-drop)
        const taskKey = `${updatedTask.id}-${updatedTask.status}`;
        if (recentLocalUpdates.has(taskKey)) {
          console.log('⏭️ Ignoring local update for task:', updatedTask.id);
          recentLocalUpdates.delete(taskKey);
          return;
        }

        console.log('🔄 Real-time triggering reload...');
        // Reload for updates from other users
        debouncedReloadTasks();
      },
      // On delete
      (deletedTask) => {
        console.log('📡 Real-time: Task deleted:', deletedTask.id);
        debouncedReloadTasks();
      }
    );
    console.log('✅ Tasks realtime subscription active:', realtimeSubscriptionId);
  } catch (error) {
    console.error('❌ Error setting up tasks realtime subscription:', error);
  }
}

/**
 * Create a debounced reload function
 */
export function createDebouncedReload(isLoadingTasks, loadTasks) {
  return function debouncedReloadTasks() {
    // Don't debounce if already loading
    if (isLoadingTasks()) {
      console.log('⏭️ Skipping debounced reload - load already in progress');
      return;
    }

    clearTimeout(reloadDebounceTimer);
    reloadDebounceTimer = setTimeout(() => {
      loadTasks();
    }, 500); // Wait 500ms before reloading
  };
}

/**
 * Track a local update to prevent reload loop
 */
export function trackLocalUpdate(taskId, newStatus) {
  const taskKey = `${taskId}-${newStatus}`;
  recentLocalUpdates.add(taskKey);

  // Remove from tracking after 3 seconds
  setTimeout(() => {
    recentLocalUpdates.delete(taskKey);
  }, 3000);
}

/**
 * Cleanup subscriptions
 */
export function cleanupRealtime() {
  realtimeService.unsubscribeAll();
}
