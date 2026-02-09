import { notificationService } from '../services/notification-service.js';

/**
 * NotificationCenter Component
 * Displays notifications in a dropdown with real-time updates
 */
export class NotificationCenter {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container ${containerId} not found`);
            return;
        }

        this.notifications = [];
        this.unreadCount = 0;
        this.isOpen = false;
        this.subscription = null;

        this.init();
    }

    async init() {
        this.render();
        await this.loadNotifications();
        await this.loadUnreadCount();
        this.setupRealtimeSubscription();
        this.setupEventListeners();
    }

    async loadNotifications() {
        try {
            this.notifications = await notificationService.getNotifications({ limit: 20 });
            this.renderNotifications();
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    async loadUnreadCount() {
        try {
            this.unreadCount = await notificationService.getUnreadCount();
            this.updateBadge();
        } catch (error) {
            console.error('Error loading unread count:', error);
        }
    }

    setupRealtimeSubscription() {
        this.subscription = notificationService.subscribeToNotifications(
            (notification) => this.handleNewNotification(notification),
            (notification) => this.handleNotificationUpdate(notification),
            (notification) => this.handleNotificationDelete(notification)
        );
    }

    handleNewNotification(notification) {
        // Add to beginning of list
        this.notifications.unshift(notification);

        // Update unread count
        if (!notification.is_read) {
            this.unreadCount++;
            this.updateBadge();

            // Show browser notification if supported
            this.showBrowserNotification(notification);
        }

        // Re-render if dropdown is open
        if (this.isOpen) {
            this.renderNotifications();
        }
    }

    handleNotificationUpdate(notification) {
        const index = this.notifications.findIndex(n => n.id === notification.id);
        if (index !== -1) {
            this.notifications[index] = { ...this.notifications[index], ...notification };

            // Update unread count
            if (notification.is_read) {
                this.loadUnreadCount();
            }

            if (this.isOpen) {
                this.renderNotifications();
            }
        }
    }

    handleNotificationDelete(notification) {
        this.notifications = this.notifications.filter(n => n.id !== notification.id);
        this.loadUnreadCount();

        if (this.isOpen) {
            this.renderNotifications();
        }
    }

    showBrowserNotification(notification) {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            const formatted = notificationService.formatNotification(notification);
            new Notification(formatted.title, {
                body: formatted.message,
                icon: '/favicon.ico'
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.showBrowserNotification(notification);
                }
            });
        }
    }

    setupEventListeners() {
        // Toggle dropdown
        this.container.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('.notification-toggle');
            if (toggleBtn) {
                e.stopPropagation();
                this.toggleDropdown();
            }
        });

        // Mark as read
        this.container.addEventListener('click', (e) => {
            const notificationItem = e.target.closest('.notification-item');
            if (notificationItem && !notificationItem.classList.contains('read')) {
                const notificationId = parseInt(notificationItem.dataset.id);
                this.markAsRead(notificationId);
            }
        });

        // Delete notification
        this.container.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.notification-delete');
            if (deleteBtn) {
                e.stopPropagation();
                const notificationId = parseInt(deleteBtn.dataset.id);
                this.deleteNotification(notificationId);
            }
        });

        // Mark all as read
        this.container.addEventListener('click', (e) => {
            const markAllBtn = e.target.closest('.notification-mark-all-read');
            if (markAllBtn) {
                this.markAllAsRead();
            }
        });

        // Clear all read
        this.container.addEventListener('click', (e) => {
            const clearBtn = e.target.closest('.notification-clear-read');
            if (clearBtn) {
                this.clearAllRead();
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.container.contains(e.target)) {
                this.closeDropdown();
            }
        });

        // Navigate to related item
        this.container.addEventListener('click', (e) => {
            const notificationItem = e.target.closest('.notification-item');
            if (notificationItem && !e.target.closest('.notification-delete')) {
                const notification = this.notifications.find(n => n.id === parseInt(notificationItem.dataset.id));
                if (notification) {
                    this.navigateToNotification(notification);
                }
            }
        });
    }

    toggleDropdown() {
        this.isOpen = !this.isOpen;
        const dropdown = this.container.querySelector('.notification-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('show', this.isOpen);
        }
    }

    closeDropdown() {
        this.isOpen = false;
        const dropdown = this.container.querySelector('.notification-dropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    }

    async markAsRead(notificationId) {
        try {
            await notificationService.markAsRead(notificationId);
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    async markAllAsRead() {
        try {
            await notificationService.markAllAsRead();
            await this.loadNotifications();
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    }

    async deleteNotification(notificationId) {
        try {
            await notificationService.deleteNotification(notificationId);
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    }

    async clearAllRead() {
        try {
            await notificationService.deleteAllRead();
            await this.loadNotifications();
        } catch (error) {
            console.error('Error clearing read notifications:', error);
        }
    }

    navigateToNotification(notification) {
        // Navigate to the related task/project
        if (notification.task_id) {
            window.location.href = `/tasks.html?task=${notification.task_id}`;
        } else if (notification.project_id) {
            window.location.href = `/projects.html?project=${notification.project_id}`;
        }
        this.closeDropdown();
    }

    updateBadge() {
        const badge = this.container.querySelector('.notification-badge');
        if (badge) {
            badge.textContent = this.unreadCount;
            badge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="notification-center">
                <button class="notification-toggle btn btn-link position-relative" aria-label="Notifications">
                    <i class="bi bi-bell fs-5"></i>
                    <span class="notification-badge position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="display: none;">
                        0
                    </span>
                </button>
                <div class="notification-dropdown dropdown-menu dropdown-menu-end">
                    <div class="notification-header d-flex justify-content-between align-items-center p-3 border-bottom">
                        <h6 class="mb-0">Notifications</h6>
                        <div class="notification-actions">
                            <button class="notification-mark-all-read btn btn-sm btn-link text-decoration-none" title="Mark all as read">
                                <i class="bi bi-check-all"></i>
                            </button>
                            <button class="notification-clear-read btn btn-sm btn-link text-decoration-none" title="Clear read">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="notification-list">
                        <div class="text-center py-4 text-muted">
                            <i class="bi bi-bell fs-3"></i>
                            <p class="mb-0 mt-2">Loading notifications...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderNotifications() {
        const listContainer = this.container.querySelector('.notification-list');

        if (this.notifications.length === 0) {
            listContainer.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-bell-slash fs-3"></i>
                    <p class="mb-0 mt-2">No notifications</p>
                </div>
            `;
            return;
        }

        const html = this.notifications.map(notification => {
            const formatted = notificationService.formatNotification(notification);
            const isUnread = !notification.is_read;

            return `
                <div class="notification-item ${isUnread ? 'unread' : 'read'}" data-id="${notification.id}">
                    <div class="notification-icon">
                        <span class="badge bg-${formatted.color}">${formatted.icon}</span>
                    </div>
                    <div class="notification-content">
                        <div class="notification-title">${formatted.title}</div>
                        <div class="notification-message">${formatted.message}</div>
                        <div class="notification-meta">
                            <span class="notification-time">${formatted.timeAgo}</span>
                            ${formatted.actorName !== 'Someone' ? `<span class="notification-actor">by ${formatted.actorName}</span>` : ''}
                        </div>
                    </div>
                    <button class="notification-delete btn btn-sm btn-link" data-id="${notification.id}" title="Delete">
                        <i class="bi bi-x"></i>
                    </button>
                    ${isUnread ? '<div class="notification-unread-dot"></div>' : ''}
                </div>
            `;
        }).join('');

        listContainer.innerHTML = html;
    }

    destroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }
}
