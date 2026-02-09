import supabase from './supabase.js';
import { getUserCompanyId } from '@utils/auth.js';

/**
 * Team Member Service
 * Handles team member queries and user management
 */
export const teamService = {
    /**
     * Get all team members in the current user's company
     * @returns {Promise<Array>} List of team members
     */
    async getTeamMembers() {
        try {
            const companyId = await getUserCompanyId();

            const { data, error } = await supabase.rpc('get_company_team_members', {
                p_company_id: companyId
            });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching team members:', error);
            throw error;
        }
    },

    /**
     * Get a specific user's details
     * @param {string} userId - User ID
     * @returns {Promise<Object>} User details
     */
    async getUserDetails(userId) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select(`
                    *,
                    user_status (
                        status,
                        status_message,
                        last_seen
                    )
                `)
                .eq('id', userId)
                .single();

            if (error) throw error;

            return data;
        } catch (error) {
            console.error('Error fetching user details:', error);
            throw error;
        }
    },

    /**
     * Update user status (online, away, busy, offline)
     * @param {string} status - Status value
     * @param {string} statusMessage - Optional status message
     * @returns {Promise<Object>} Updated status
     */
    async updateStatus(status, statusMessage = null) {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from('user_status')
                .upsert({
                    user_id: user.id,
                    status,
                    status_message: statusMessage,
                    last_seen: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            return data;
        } catch (error) {
            console.error('Error updating status:', error);
            throw error;
        }
    },

    /**
     * Update last seen timestamp
     * @returns {Promise<void>}
     */
    async updateLastSeen() {
        try {
            await supabase.rpc('update_user_last_seen');
        } catch (error) {
            console.error('Error updating last seen:', error);
        }
    },

    /**
     * Subscribe to team member status changes
     * @param {Function} callback - Callback for status updates
     * @returns {Object} Subscription object with unsubscribe method
     */
    subscribeToTeamStatus(callback) {
        const channel = supabase
            .channel('team-status-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_status'
                },
                (payload) => {
                    if (callback) {
                        callback(payload);
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
     * Get user initials from name
     * @param {string} fullName - Full name
     * @returns {string} Initials (e.g., "JD")
     */
    getInitials(fullName) {
        if (!fullName) return '?';
        const parts = fullName.trim().split(' ');
        return parts
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join('')
            .slice(0, 2);
    },

    /**
     * Get status color
     * @param {string} status - Status value
     * @returns {string} Bootstrap color class
     */
    getStatusColor(status) {
        const colors = {
            online: 'success',
            away: 'warning',
            busy: 'danger',
            offline: 'secondary'
        };
        return colors[status] || 'secondary';
    },

    /**
     * Format last seen time
     * @param {string} lastSeen - ISO timestamp
     * @returns {string} Human-readable last seen
     */
    formatLastSeen(lastSeen) {
        if (!lastSeen) return 'Never';

        const now = new Date();
        const then = new Date(lastSeen);
        const diffMs = now - then;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return then.toLocaleDateString();
    }
};
