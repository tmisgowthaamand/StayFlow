/**
 * StayFlow In-App Notification Manager
 * Persists notifications locally using AsyncStorage.
 * Supports: invoice_sent, payment_received, new_registration
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

const STORAGE_KEY = '@stayflow_notifications';
const DELETED_IDS_KEY = '@stayflow_deleted_ids';
const MAX_NOTIFICATIONS = 100;

/**
 * Notification types with icons & colors
 */
export const NOTIFICATION_TYPES = {
    INVOICE_SENT: {
        key: 'invoice_sent',
        label: 'Invoice Sent',
        icon: 'FileText',
        gradient: ['#6C63FF', '#4B44CC'],
        color: '#6C63FF',
    },
    PAYMENT_RECEIVED: {
        key: 'payment_received',
        label: 'Payment Received',
        icon: 'CheckCircle',
        gradient: ['#10B981', '#059669'],
        color: '#10B981',
    },
    NEW_REGISTRATION: {
        key: 'new_registration',
        label: 'New Registration',
        icon: 'UserPlus',
        gradient: ['#FF6B9D', '#F43F5E'],
        color: '#FF6B9D',
    },
    BULK_NOTIFY: {
        key: 'bulk_notify',
        label: 'Bulk Notification',
        icon: 'Send',
        gradient: ['#F59E0B', '#D97706'],
        color: '#F59E0B',
    },
    BULK_NOTIFY_REPORT: {
        key: 'bulk_notify_report',
        label: 'Bulk Bills Report',
        icon: 'Megaphone',
        gradient: ['#10B981', '#3B82F6'],
        color: '#10B981',
    },
    EB_SPLIT: {
        key: 'eb_split',
        label: 'EB Bill Split',
        icon: 'Zap',
        gradient: ['#8B5CF6', '#6C63FF'],
        color: '#8B5CF6',
    },
    ANNOUNCEMENT: {
        key: 'announcement',
        label: 'Announcement',
        icon: 'Megaphone',
        gradient: ['#60A5FA', '#3B82F6'],
        color: '#60A5FA',
    },
};

/**
 * Generate a unique ID
 */
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

/**
 * Format a date into a readable string
 */
export const formatNotificationTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // Less than 1 minute
    if (diff < 60000) return 'Just now';

    // Less than 1 hour
    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `${mins}m ago`;
    }

    // Less than 24 hours
    if (diff < 86400000) {
        const hrs = Math.floor(diff / 3600000);
        return `${hrs}h ago`;
    }

    // Same year
    const options = { day: 'numeric', month: 'short' };
    if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString('en-IN', { ...options, hour: '2-digit', minute: '2-digit', hour12: true });
    }

    // Different year
    return date.toLocaleDateString('en-IN', { ...options, year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
};

/**
 * Format the full date and time
 */
export const formatFullDateTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });
};

import { getNotifications as fetchServerNotifications, markNotificationsAsRead, clearAllNotifications as clearServerNotifications, getUnreadNotificationCount } from '../api/api';

// ─── Core CRUD ─────────────────────────────────────────────────

/**
 * Get all notifications (Merged Server + Local)
 */
export const getNotifications = async () => {
    try {
        // 1. Get server notifications
        let serverNotifications = [];
        try {
            const data = await fetchServerNotifications();
            serverNotifications = data.map(n => ({
                id: n._id || n.id,
                type: n.type,
                title: n.title,
                body: n.body,
                meta: n.meta,
                timestamp: n.timestamp,
                read: n.read,
                isServer: true
            }));
        } catch (err) {
            console.warn('Could not fetch server notifications:', err.message);
        }

        // 2. Get local notifications
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const localNotifications = raw ? JSON.parse(raw) : [];

        // 3. Filter out locally deleted server notifications
        const deletedRaw = await AsyncStorage.getItem(DELETED_IDS_KEY);
        const deletedIds = deletedRaw ? JSON.parse(deletedRaw) : [];

        const combined = [...serverNotifications, ...localNotifications]
            .filter(n => !deletedIds.includes(n.id))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return combined.slice(0, MAX_NOTIFICATIONS);
    } catch (e) {
        console.error('Failed to read notifications:', e);
        return [];
    }
};

/**
 * Add a new notification
 * @param {string} type - One of NOTIFICATION_TYPES keys
 * @param {string} title - Main title text
 * @param {string} body - Description text
 * @param {object} meta - Extra metadata (tenantName, room, amount, etc.)
 */
export const addNotification = async (type, title, body, meta = {}, bannerOnly = false) => {
    try {
        const newNotification = {
            id: generateId(),
            type,
            title,
            body,
            meta,
            timestamp: new Date().toISOString(),
            read: false,
        };

        if (!bannerOnly) {
            // Get ONLY local notifications for saving
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            const localNotifications = raw ? JSON.parse(raw) : [];

            // Prepend (newest first) and cap at MAX
            const updated = [newNotification, ...localNotifications].slice(0, MAX_NOTIFICATIONS);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        }

        // 🔔 Trigger System Notification
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data: { ...meta, type },
                sound: 'default',
                priority: 'max',
                channelId: 'default'
            },
            trigger: null, // Immediate
        });

        return newNotification;
    } catch (e) {
        console.error('Failed to save notification:', e);
    }
};

/**
 * Request permissions (call on app start)
 */
export const requestNotificationPermissions = async () => {
    // Expo Go SDK 53+ on Android has removed remote push support, 
    // but local notifications still work. We check Device.isDevice 
    // to avoid some unnecessary warnings on emulators.
    if (Platform.OS === 'android' && !Device.isDevice) {
        return false;
    }

    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.warn('Notification permissions not granted');
            return false;
        }

        // Only on Android: Set up notification channel for local notifications
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#6C63FF',
            });
        }

        return true;
    } catch (error) {
        console.error('Error requesting notification permissions:', error.message);
        return false;
    }
};

/**
 * Mark a single notification as read
 */
export const markAsRead = async (notificationId, isServer = false) => {
    try {
        if (isServer) {
            await markNotificationsAsRead(notificationId);
        } else {
            const notifications = await getNotifications();
            const updated = notifications.map(n =>
                n.id === notificationId ? { ...n, read: true } : n
            );
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated.filter(n => !n.isServer)));
        }
    } catch (e) {
        console.error('Failed to mark read:', e);
    }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async () => {
    try {
        // Mark server ones
        await markNotificationsAsRead();
        // Mark local ones
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
            const notifications = JSON.parse(raw);
            const updated = notifications.map(n => ({ ...n, read: true }));
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        }
    } catch (e) {
        console.error('Failed to mark all read:', e);
    }
};

/**
 * Delete a single notification
 */
export const deleteNotification = async (notificationId) => {
    try {
        const notifications = await getNotifications();
        const notification = notifications.find(n => n.id === notificationId);

        if (notification && notification.isServer) {
            // Add to deleted IDs list
            const rawDeleted = await AsyncStorage.getItem(DELETED_IDS_KEY);
            const deletedIds = rawDeleted ? JSON.parse(rawDeleted) : [];
            if (!deletedIds.includes(notificationId)) {
                deletedIds.push(notificationId);
                await AsyncStorage.setItem(DELETED_IDS_KEY, JSON.stringify(deletedIds));
            }
        }

        const updated = notifications.filter(n => n.id !== notificationId);
        // Only save local notifications back to storage
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated.filter(n => !n.isServer)));
    } catch (e) {
        console.error('Failed to delete notification:', e);
    }
};

/**
 * Clear all notifications
 */
export const clearAllNotifications = async () => {
    try {
        await clearServerNotifications();
        await AsyncStorage.removeItem(STORAGE_KEY);
        await AsyncStorage.removeItem(DELETED_IDS_KEY);
    } catch (e) {
        console.error('Failed to clear notifications:', e);
    }
};

/**
 * Get unread count (Server + Local)
 */
export const getUnreadCount = async () => {
    try {
        let serverCount = 0;
        try {
            const data = await getUnreadNotificationCount();
            serverCount = data.count || 0;
        } catch (e) { }

        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const localNotifications = raw ? JSON.parse(raw) : [];
        const localCount = localNotifications.filter(n => !n.read).length;

        return serverCount + localCount;
    } catch (e) {
        return 0;
    }
};

// ─── Helper: Create specific notifications ─────────────────────

// Note: many of these are now also created on the server.
// We use bannerOnly: true to trigger the top-level system notification 
// immediately without duplicating the entry in the bell panel (which comes from server).

export const notifyInvoiceSent = (tenantName, room, amount) =>
    addNotification(
        'invoice_sent',
        `Invoice sent to ${tenantName}`,
        `₹${amount} invoice sent for Room ${room}`,
        { tenantName, room, amount },
        true // bannerOnly
    );

export const notifyPaymentReceived = (tenantName, room, amount, mode) =>
    addNotification(
        'payment_received',
        `Payment from ${tenantName}`,
        `₹${amount} received via ${mode} — Room ${room}`,
        { tenantName, room, amount, mode },
        true // bannerOnly
    );

export const notifyNewRegistration = (tenantName, room, phone) =>
    addNotification(
        'new_registration',
        `New resident: ${tenantName}`,
        `Registered in Room ${room} • ${phone}`,
        { tenantName, room, phone },
        true // bannerOnly
    );

export const notifyBulkInvoice = (count) =>
    addNotification(
        'bulk_notify',
        `Bulk invoices sent`,
        `Invoices sent to ${count} residents`,
        { count },
        true // bannerOnly
    );

export const notifyIssueSubmitted = (category, name, room, issue) =>
    addNotification(
        'issue_submitted',
        `New Issue: ${category}`,
        `${name} (Room ${room}): ${issue}`,
        { tenantName: name, room, category, issue },
        false // This might come from server, but good to have local fallback
    );

export const notifyEBSplit = (room, perPerson, count) =>
    addNotification(
        'eb_split',
        `EB bill split — Room ${room}`,
        `₹${perPerson}/person for ${count} residents`,
        { room, perPerson, count },
        true // bannerOnly
    );
export const notifyAnnouncement = (message, count, imageUrl) =>
    addNotification(
        'announcement',
        `📢 New Announcement`,
        message || `Sent to ${count} residents`,
        { message, count, imageUrl },
        true // bannerOnly
    );

export const notifyDirectMessage = (name, message) =>
    addNotification(
        'announcement',
        `Message to ${name}`,
        message,
        { name, message },
        true // bannerOnly
    );
