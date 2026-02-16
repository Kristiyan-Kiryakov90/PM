import { teamService } from '../services/team-service.js';
import { renderUserListItem } from './user-avatar.js';

/**
 * Team Panel Component
 * Displays list of team members with status
 */
export class TeamPanel {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container ${containerId} not found`);
            return;
        }

        this.teamMembers = [];
        this.subscription = null;

        this.init();
    }

    async init() {
        this.render();
        await this.loadTeamMembers();
        this.setupRealtimeSubscription();
        this.setupHeartbeat();
    }

    async loadTeamMembers() {
        try {
            this.teamMembers = await teamService.getTeamMembers();
            this.renderTeamList();
        } catch (error) {
            console.error('Error loading team members:', error);
            this.showError('Failed to load team members');
        }
    }

    setupRealtimeSubscription() {
        this.subscription = teamService.subscribeToTeamStatus((payload) => {
            this.handleStatusUpdate(payload);
        });
    }

    setupHeartbeat() {
        // Update last seen every 5 minutes
        setInterval(() => {
            teamService.updateLastSeen();
        }, 5 * 60 * 1000);

        // Update on page load
        teamService.updateLastSeen();

        // Update status to offline when page unloads
        window.addEventListener('beforeunload', () => {
            teamService.updateStatus('offline');
        });
    }

    handleStatusUpdate(payload) {
        const { new: newStatus, old: oldStatus, eventType } = payload;

        if (eventType === 'UPDATE' || eventType === 'INSERT') {
            const memberIndex = this.teamMembers.findIndex(
                m => m.user_id === newStatus.user_id
            );

            if (memberIndex !== -1) {
                this.teamMembers[memberIndex] = {
                    ...this.teamMembers[memberIndex],
                    status: newStatus.status,
                    status_message: newStatus.status_message,
                    last_seen: newStatus.last_seen
                };
                this.renderTeamList();
            }
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="team-panel">
                <div class="team-panel-header">
                    <h6 class="mb-0">Team Members</h6>
                    <span class="team-count badge bg-primary">0</span>
                </div>
                <div class="team-panel-body">
                    <div class="team-list">
                        <div class="text-center py-3 text-muted">
                            <i class="bi bi-people fs-3"></i>
                            <p class="mb-0 mt-2">Loading team...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderTeamList() {
        const teamList = this.container.querySelector('.team-list');
        const teamCount = this.container.querySelector('.team-count');

        if (!this.teamMembers || this.teamMembers.length === 0) {
            teamList.innerHTML = `
                <div class="text-center py-3 text-muted">
                    <i class="bi bi-people fs-3"></i>
                    <p class="mb-0 mt-2">No team members</p>
                </div>
            `;
            teamCount.textContent = '0';
            return;
        }

        // Sort by status (online first) and then by name
        const sortedMembers = [...this.teamMembers].sort((a, b) => {
            const statusOrder = { online: 0, away: 1, busy: 2, offline: 3 };
            const statusDiff = (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
            if (statusDiff !== 0) return statusDiff;
            return (a.full_name || a.email).localeCompare(b.full_name || b.email);
        });

        teamList.innerHTML = sortedMembers.map(member =>
            renderUserListItem(member, {
                showRole: true,
                showStatus: true,
                showEmail: true
            })
        ).join('');

        teamCount.textContent = this.teamMembers.length;
    }

    showError(message) {
        const teamList = this.container.querySelector('.team-list');
        if (teamList) {
            teamList.innerHTML = `
                <div class="alert alert-danger mb-0">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    ${message}
                </div>
            `;
        }
    }

    destroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }
}
