// Utility functions for StudyHub

// Initialize global utils object
window.utils = window.utils || {};

// Notification system
window.utils.showNotification = function(message, type = 'info') {
    // Create notification element if it doesn't exist
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;

    container.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);

    // Add animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
};

function getNotificationIcon(type) {
    switch(type) {
        case 'success': return '✅';
        case 'error': return '❌';
        case 'warning': return '⚠️';
        case 'info':
        default: return 'ℹ️';
    }
}

// Date formatting utilities
window.utils.formatDateTime = function(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

window.utils.formatDate = function(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
};

window.utils.formatTime = function(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

window.utils.formatTimeAgo = function(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return window.utils.formatDate(dateString);
};

// Empty state helper
window.utils.showEmptyState = function(container, title, description) {
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <h3>${title}</h3>
            <p>${description}</p>
        </div>
    `;
};

// Loading state helper
window.utils.showLoading = function(container, message = 'Loading...') {
    container.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>${message}</p>
        </div>
    `;
};

// Validation helpers
window.utils.validateEmail = function(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

window.utils.validatePassword = function(password) {
    return password.length >= 6;
};

// File upload helpers
window.utils.formatFileSize = function(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

window.utils.getFileExtension = function(filename) {
    return filename.split('.').pop().toLowerCase();
};

// Modal helpers
window.utils.closeAllModals = function() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
};

// Local storage helpers
window.utils.saveToStorage = function(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
};

window.utils.getFromStorage = function(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return defaultValue;
    }
};

// Initialize global app state
window.appState = window.appState || {
    currentUser: null,
    userRole: null,
    currentSection: 'overview'
};

// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.utils;
}
