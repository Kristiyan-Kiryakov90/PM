import supabase from './supabase.js';
import { authUtils } from '@utils/auth.js';

/**
 * Notification Service
 * Handles CRUD operations and real-time subscriptions for notifications
 */
export const notificationService = {
    /**
     * Get notifications for current user
     * @param {Object} options - Query options
     * @param {boolean} options.unreadOnly - Filter for unread notifications only
     * @param {number} options.limit - Limit number of results
     * @param {number} options.offset - Offset for pagination
     * @returns {Promise<Array>} List of notifications with actor details
     */
    async getNotifications({ unreadOnly = false, limit = 50, offset = 0 } = {}) {
        let query = supabase
            .from('notifications')
            .select(`
                *,
                task:tasks!task_id (
                    id,
                    title
                ),
                project:projects!project_id (
                    id,
                    name
                )
            `)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (unreadOnly) {
            query = query.eq('is_read', false);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching notifications:', error);
            throw error;
        }

        return data || [];
    },

    /**
     * Get unread notification count
     * @returns {Promise<number>} Count of unread notifications
     */
    async getUnreadCount() {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('is_read', false);

        if (error) {
            console.error('Error fetching unread count:', error);
            throw error;
        }

        return count || 0;
    },

    /**
     * Mark notification as read
     * @param {number} notificationId - Notification ID
     * @returns {Promise<Object>} Updated notification
     */
    async markAsRead(notificationId) {
        const { data, error } = await supabase
            .from('notifications')
            .update({
                is_read: true,
                read_at: new Date().toISOString()
            })
            .eq('id', notificationId)
            .select()
            .single();

        if (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }

        return data;
    },

    /**
     * Mark all notifications as read
     * @returns {Promise<Array>} Updated notifications
     */
    async markAllAsRead() {
        const { data, error } = await supabase
            .from('notifications')
            .update({
                is_read: true,
                read_at: new Date().toISOString()
            })
            .eq('is_read', false)
            .select();

        if (error) {
            console.error('Error marking all notifications as read:', error);
            throw error;
        }

        return data || [];
    },

    /**
     * Delete notification
     * @param {number} notificationId - Notification ID
     * @returns {Promise<void>}
     */
    async deleteNotification(notificationId) {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId);

        if (error) {
            console.error('Error deleting notification:', error);
            throw error;
        }
    },

    /**
     * Delete all read notifications
     * @returns {Promise<void>}
     */
    async deleteAllRead() {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('is_read', true);

        if (error) {
            console.error('Error deleting read notifications:', error);
            throw error;
        }
    },

    /**
     * Create a manual notification (for testing or special cases)
     * @param {Object} notification - Notification data
     * @returns {Promise<Object>} Created notification
     */
    async createNotification(notification) {
        const currentUser = await authUtils.getCurrentUser();

        const { data, error } = await supabase
            .from('notifications')
            .insert({
                user_id: notification.userId || currentUser?.id,
                company_id: notification.companyId || null,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                task_id: notification.taskId || null,
                project_id: notification.projectId || null,
                comment_id: notification.commentId || null,
                actor_id: notification.actorId || null
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating notification:', error);
            throw error;
        }

        return data;
    },

    /**
     * Subscribe to real-time notification updates
     * @param {Function} onInsert - Callback for new notifications
     * @param {Function} onUpdate - Callback for updated notifications
     * @param {Function} onDelete - Callback for deleted notifications
     * @returns {Object} Subscription object with unsubscribe method
     */
    subscribeToNotifications(onInsert, onUpdate, onDelete) {
        const channel = supabase
            .channel('notifications-changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications'
                },
                async (payload) => {
                    // Fetch full notification with relations
                    const { data } = await supabase
                        .from('notifications')
                        .select(`
                            *,
                            task:tasks!task_id (
                                id,
                                title
                            ),
                            project:projects!project_id (
                                id,
                                name
                            )
                        `)
                        .eq('id', payload.new.id)
                        .single();

                    if (data && onInsert) {
                        onInsert(data);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'notifications'
                },
                (payload) => {
                    if (onUpdate) {
                        onUpdate(payload.new);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'notifications'
                },
                (payload) => {
                    if (onDelete) {
                        onDelete(payload.old);
                    }
                }
            )
            .subscribe();

        return {
            unsubscribe: () => {
                supabase.removeChannel(channel);
            }
        };
    },

    /**
     * Format notification for display
     * @param {Object} notification - Notification object
     * @returns {Object} Formatted notification with display properties
     */
    formatNotification(notification) {
        // Actor details are not included in the query to avoid auth.users joins
        // The notification message already contains the relevant information
        const actorName = 'Someone';

        let icon = '🔔';
        let color = 'primary';

        switch (notification.type) {
            case 'mention':
                icon = '💬';
                color = 'info';
                break;
            case 'assignment':
                icon = '📋';
                color = 'success';
                break;
            case 'comment':
            case 'reply':
                icon = '💭';
                color = 'info';
                break;
            case 'status_change':
                icon = '🔄';
                color = 'warning';
                break;
            case 'due_date':
                icon = '⏰';
                color = 'danger';
                break;
            case 'task_completed':
                icon = '✅';
                color = 'success';
                break;
            case 'project_update':
                icon = '📁';
                color = 'primary';
                break;
        }

        return {
            ...notification,
            actorName,
            icon,
            color,
            timeAgo: this.getTimeAgo(notification.created_at)
        };
    },

    /**
     * Get time ago string
     * @param {string} timestamp - ISO timestamp
     * @returns {string} Human-readable time ago
     */
    getTimeAgo(timestamp) {
        const now = new Date();
        const past = new Date(timestamp);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return past.toLocaleDateString();
    }
};
