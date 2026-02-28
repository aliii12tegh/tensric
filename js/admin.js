/* ═══════════════════════════════════════════════════════════════
   TENSRIC - Admin Dashboard Controller
   ═══════════════════════════════════════════════════════════════ */

const AdminDashboard = (() => {
    let allUsersData = [];

    // Initialize the admin dashboard
    async function init() {
        const currentUser = NexusAuth.getCurrentUser();

        // Double check admin status
        if (!currentUser || !currentUser.isAdmin) {
            window.location.replace('dashboard.html');
            return;
        }

        // Set User Profile UI
        if (document.getElementById('userName')) {
            document.getElementById('userName').textContent = currentUser.name || 'Admin';
            document.getElementById('userEmail').textContent = currentUser.email || '';
            const avatarEl = document.getElementById('userAvatar');
            avatarEl.textContent = (currentUser.name || 'A').charAt(0).toUpperCase();

            if (currentUser.avatarColor) {
                avatarEl.style.background = currentUser.avatarColor;
            } else {
                avatarEl.style.background = 'var(--gradient-primary)';
            }
        }

        await fetchStats();
        // Load users quietly in the background
        fetchUsersQuietly();
    }

    // Tab Switching
    function switchTab(tabId) {
        document.querySelectorAll('.admin-tab').forEach(el => el.classList.remove('active'));
        const tabEl = document.getElementById(`tab-${tabId}`);
        if (tabEl) tabEl.classList.add('active');

        document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => el.classList.remove('active'));

        if (tabId === 'overview') {
            const el = document.querySelector('.sidebar-nav .nav-item[href="admin.html"]');
            if (el) el.classList.add('active');
        } else {
            const el = document.getElementById(`nav-${tabId}`);
            if (el) el.classList.add('active');
        }
    }

    // Show/Hide Loading
    function showLoading() {
        const el = document.getElementById('loadingOverlay');
        if (el) el.classList.remove('hidden');
    }

    function hideLoading() {
        const el = document.getElementById('loadingOverlay');
        if (el) el.classList.add('hidden');
    }

    // Fetch Stats for Overview
    async function fetchStats() {
        showLoading();
        try {
            const response = await fetch('/api/admin-stats', {
                headers: {
                    'Authorization': `Bearer ${NexusAuth.getToken()}`
                }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    NexusAuth.logout();
                }
                throw new Error('Failed to fetch stats');
            }

            const data = await response.json();

            if (data.success && data.stats) {
                renderStats(data.stats);
            }
        } catch (error) {
            console.error('Error fetching admin stats:', error);
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('Error loading statistics', 'error');
            }
        } finally {
            hideLoading();
        }
    }

    // Fetch Users Background
    async function fetchUsersQuietly() {
        try {
            const response = await fetch('/api/admin-users', {
                headers: {
                    'Authorization': `Bearer ${NexusAuth.getToken()}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.users) {
                    allUsersData = data.users;
                    renderUsersTable(allUsersData);
                }
            }
        } catch (e) {
            console.error('Background fetch users failed', e);
        }
    }

    // Fetch Users for Directory (Manual Trigger)
    async function fetchUsers() {
        showLoading();
        try {
            const response = await fetch('/api/admin-users', {
                headers: {
                    'Authorization': `Bearer ${NexusAuth.getToken()}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch users');

            const data = await response.json();

            if (data.success && data.users) {
                allUsersData = data.users;
                renderUsersTable(allUsersData);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('Error loading user directory', 'error');
            }
        } finally {
            hideLoading();
        }
    }

    // Render stats to DOM
    function renderStats(stats) {
        animateValue('stat-total-users', 0, stats.totalUsers || 0, 1000);
        animateValue('stat-active-users', 0, stats.activeUsers || 0, 1000);
        animateValue('stat-total-images', 0, stats.totalImagesGenerated || 0, 1000);
        animateValue('stat-total-videos', 0, stats.totalVideosGenerated || 0, 1000);

        const recentTableBody = document.querySelector('#recent-users-table tbody');
        if (recentTableBody && stats.newestUsers) {
            recentTableBody.innerHTML = stats.newestUsers.map(u => `
                <tr>
                    <td>
                        <div class="user-cell">
                            <div class="avatar-small">${(u.name || '?').charAt(0).toUpperCase()}</div>
                            <span class="name">${u.name || 'Unknown'}</span>
                        </div>
                    </td>
                    <td class="text-muted" style="font-size: 13px;">${u.email}</td>
                    <td class="text-muted" style="font-size: 13px;">${timeAgo(new Date(u.createdAt))}</td>
                    <td style="font-family: monospace;">${u.credits || 0} cr</td>
                </tr>
            `).join('');
        }
    }

    // Render users directory table
    function renderUsersTable(users) {
        const tableBody = document.querySelector('#all-users-table tbody');
        if (!tableBody) return;

        if (users.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">No users found</td></tr>`;
            return;
        }

        tableBody.innerHTML = users.map(user => {
            const initial = (user.name || '?').charAt(0).toUpperCase();
            const roleBadge = user.isAdmin ? '<span class="badge admin">Admin</span>' : '<span class="badge user">User</span>';
            const planBadge = user.plan === 'pro' ? '<span class="badge pro">Pro</span>' : '<span class="badge free">Free</span>';
            const joined = new Date(user.createdAt).toLocaleDateString();
            const lastActive = timeAgo(new Date(user.updatedAt || user.createdAt));

            return `
                <tr>
                    <td>
                        <div class="user-cell">
                            <div class="avatar-small">${initial}</div>
                            <div class="user-details">
                                <span class="name">${user.name || 'Unknown User'}</span>
                                <span class="email">${user.email}</span>
                            </div>
                        </div>
                    </td>
                    <td>${planBadge}</td>
                    <td>${roleBadge}</td>
                    <td style="font-family: monospace; font-size: 15px;">${user.credits || 0}</td>
                    <td>
                        <span style="color: var(--text-muted); font-size: 13px;">
                            ${user.stats?.images || 0} / ${user.stats?.videos || 0}
                        </span>
                    </td>
                    <td style="color: var(--text-muted); font-size: 13px;">${joined}</td>
                    <td style="color: var(--text-muted); font-size: 13px;">${lastActive}</td>
                </tr>
            `;
        }).join('');
    }

    function filterUsers(query) {
        const q = query.toLowerCase().trim();
        if (!q) {
            renderUsersTable(allUsersData);
            return;
        }

        const filtered = allUsersData.filter(u =>
            (u.name && u.name.toLowerCase().includes(q)) ||
            (u.email && u.email.toLowerCase().includes(q))
        );
        renderUsersTable(filtered);
    }

    // Animate number
    function animateValue(id, start, end, duration) {
        const obj = document.getElementById(id);
        if (!obj) return;

        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    function timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "m ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " min ago";
        return Math.floor(seconds) + "s ago";
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        switchTab,
        fetchUsers,
        filterUsers
    };
})();
