/**
 * Realtime Service
 * Handles Supabase Realtime subscriptions for live updates
 */

import supabase from './supabase.js';
import { authUtils } from '@utils/auth.js';

// Store active subscriptions
const subscriptions = new Map();

export const realtimeService = {

  /**
   * Subscribe to tasks table changes
   * @param {Function} onInsert - Callback when task is inserted
   * @param {Function} onUpdate - Callback when task is updated
   * @param {Function} onDelete - Callback when task is deleted
   * @returns {Promise<string>} Subscription ID
   */
  async subscribeToTasks(onInsert, onUpdate, onDelete) {
    try {
      const companyId = await authUtils.getUserCompanyId();
      const user = await supabase.auth.getUser();
      const userId = user.data?.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Create unique subscription ID
      const subscriptionId = companyId
        ? `tasks_company_${companyId}_${Date.now()}`
        : `tasks_personal_${userId}_${Date.now()}`;

      // For company users: filter by company_id
      // For personal users: filter by created_by (RLS will handle NULL company_id)
      const filter = companyId
        ? `company_id=eq.${companyId}`
        : `created_by=eq.${userId}`;

      console.log('Setting up realtime subscription:', { companyId, userId, filter });

      // Subscribe to tasks channel
      const channel = supabase
        .channel(subscriptionId)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tasks',
            filter: filter,
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
            filter: filter,
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
            filter: filter,
          },
          (payload) => {
            console.log('Task deleted:', payload);
            if (onDelete) {
              onDelete(payload.old);
            }
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Tasks realtime subscription ACTIVE:', subscriptionId);
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Tasks realtime subscription ERROR:', err);
          } else {
            console.log('📡 Tasks realtime subscription status:', status);
          }
        });

      // Store subscription
      subscriptions.set(subscriptionId, channel);

      return subscriptionId;
    } catch (error) {
      console.error('Error subscribing to tasks:', error);
      throw error;
    }
  },

  /**
   * Unsubscribe from a channel
   * @param {string} subscriptionId - Subscription ID to unsubscribe
   */
  async unsubscribe(subscriptionId) {
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
  },

  /**
   * Unsubscribe from all active subscriptions
   */
  async unsubscribeAll() {
    try {
      for (const [id, channel] of subscriptions.entries()) {
        await supabase.removeChannel(channel);
        subscriptions.delete(id);
      }
      console.log('Unsubscribed from all channels');
    } catch (error) {
      console.error('Error unsubscribing from all:', error);
    }
  },

  /**
   * Subscribe to projects table changes
   * @param {Function} onInsert - Callback when project is inserted
   * @param {Function} onUpdate - Callback when project is updated
   * @param {Function} onDelete - Callback when project is deleted
   * @returns {Promise<string>} Subscription ID
   */
  async subscribeToProjects(onInsert, onUpdate, onDelete) {
    try {
      const companyId = await authUtils.getUserCompanyId();
      const user = await supabase.auth.getUser();
      const userId = user.data?.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Create unique subscription ID
      const subscriptionId = companyId
        ? `projects_company_${companyId}_${Date.now()}`
        : `projects_personal_${userId}_${Date.now()}`;

      // For company users: filter by company_id
      // For personal users: filter by created_by
      const filter = companyId
        ? `company_id=eq.${companyId}`
        : `created_by=eq.${userId}`;

      console.log('Setting up projects realtime subscription:', { companyId, userId, filter });

      // Subscribe to projects channel
      const channel = supabase
        .channel(subscriptionId)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'projects',
            filter: filter,
          },
          (payload) => {
            console.log('📡 Project inserted:', payload.new);
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
            table: 'projects',
            filter: filter,
          },
          (payload) => {
            console.log('📡 Project updated:', payload.new);
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
            table: 'projects',
            filter: filter,
          },
          (payload) => {
            console.log('📡 Project deleted:', payload.old);
            if (onDelete) {
              onDelete(payload.old);
            }
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Projects realtime subscription ACTIVE:', subscriptionId);
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Projects realtime subscription ERROR:', err);
          } else {
            console.log('📡 Projects realtime subscription status:', status);
          }
        });

      // Store subscription
      subscriptions.set(subscriptionId, channel);

      return subscriptionId;
    } catch (error) {
      console.error('Error subscribing to projects:', error);
      throw error;
    }
  },

  /**
   * Get number of active subscriptions
   * @returns {number}
   */
  getActiveSubscriptionsCount() {
    return subscriptions.size;
  }

};
