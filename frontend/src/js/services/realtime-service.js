/**
 * Realtime Service
 * Handles Supabase Realtime subscriptions for live updates
 */

import supabase from './supabase.js';
import { getUserCompanyId } from '@utils/auth.js';

// Store active subscriptions
const subscriptions = new Map();

/**
 * Subscribe to tasks table changes
 * @param {Function} onInsert - Callback when task is inserted
 * @param {Function} onUpdate - Callback when task is updated
 * @param {Function} onDelete - Callback when task is deleted
 * @returns {Promise<string>} Subscription ID
 */
export async function subscribeToTasks(onInsert, onUpdate, onDelete) {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('User does not belong to any company');
    }

    // Create unique subscription ID
    const subscriptionId = `tasks_${companyId}_${Date.now()}`;

    // Subscribe to tasks channel filtered by company
    const channel = supabase
      .channel(subscriptionId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('Task inserted:', payload);
          if (onInsert) {
            onInsert(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('Task updated:', payload);
          if (onUpdate) {
            onUpdate(payload.new, payload.old);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'tasks',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('Task deleted:', payload);
          if (onDelete) {
            onDelete(payload.old);
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    // Store subscription
    subscriptions.set(subscriptionId, channel);

    return subscriptionId;
  } catch (error) {
    console.error('Error subscribing to tasks:', error);
    throw error;
  }
}

/**
 * Unsubscribe from a channel
 * @param {string} subscriptionId - Subscription ID to unsubscribe
 */
export async function unsubscribe(subscriptionId) {
  try {
    const channel = subscriptions.get(subscriptionId);
    if (channel) {
      await supabase.removeChannel(channel);
      subscriptions.delete(subscriptionId);
      console.log('Unsubscribed from:', subscriptionId);
    }
  } catch (error) {
    console.error('Error unsubscribing:', error);
  }
}

/**
 * Unsubscribe from all active subscriptions
 */
export async function unsubscribeAll() {
  try {
    for (const [id, channel] of subscriptions.entries()) {
      await supabase.removeChannel(channel);
      subscriptions.delete(id);
    }
    console.log('Unsubscribed from all channels');
  } catch (error) {
    console.error('Error unsubscribing from all:', error);
  }
}

/**
 * Get number of active subscriptions
 * @returns {number}
 */
export function getActiveSubscriptionsCount() {
  return subscriptions.size;
}
