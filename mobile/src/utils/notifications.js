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
    EB_SPLIT: {
        key: 'eb_split',
        label: 'EB Bill Split',
        icon: 'Zap',
        gradient: ['#8B5CF6', '#6C63FF'],
        color: '#8B5CF6',
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

// ─── Core CRUD ─────────────────────────────────────────────────

/**
 * Get all notifications from storage
 */
export const getNotifications = async () => {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
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
export const addNotification = async (type, title, body, meta = {}) => {
    try {
        const notifications = await getNotifications();
        const newNotification = {
            id: generateId(),
            type,
            title,
            body,
            meta,
            timestamp: new Date().toISOString(),
            read: false,
        };

        // Prepend (newest first) and cap at MAX
        const updated = [newNotification, ...notifications].slice(0, MAX_NOTIFICATIONS);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

        // 🔔 Trigger System Notification
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data: { ...meta, type },
                sound: 'default',
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
    // Basic check for physical device (Expo Go limitations for SDK 54+)
    if (Platform.OS === 'android' && !Device.isDevice) {
        console.log('Skipping push notification permission request on Android Emulator/Expo Go');
        return false;
    }

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        return newStatus === 'granted';
    }
    return true;
};

/**
 * Mark a single notification as read
 */
export const markAsRead = async (notificationId) => {
    try {
        const notifications = await getNotifications();
        const updated = notifications.map(n =>
            n.id === notificationId ? { ...n, read: true } : n
        );
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
        console.error('Failed to mark read:', e);
    }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async () => {
    try {
        const notifications = await getNotifications();
        const updated = notifications.map(n => ({ ...n, read: true }));
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
        const updated = notifications.filter(n => n.id !== notificationId);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
        console.error('Failed to delete notification:', e);
    }
};

/**
 * Clear all notifications
 */
export const clearAllNotifications = async () => {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.error('Failed to clear notifications:', e);
    }
};

/**
 * Get unread count
 */
export const getUnreadCount = async () => {
    const notifications = await getNotifications();
    return notifications.filter(n => !n.read).length;
};

// ─── Helper: Create specific notifications ─────────────────────

export const notifyInvoiceSent = (tenantName, room, amount) =>
    addNotification(
        'invoice_sent',
        `Invoice sent to ${tenantName}`,
        `₹${amount} invoice sent for Room ${room}`,
        { tenantName, room, amount }
    );

export const notifyPaymentReceived = (tenantName, room, amount, mode) =>
    addNotification(
        'payment_received',
        `Payment from ${tenantName}`,
        `₹${amount} received via ${mode} — Room ${room}`,
        { tenantName, room, amount, mode }
    );

export const notifyNewRegistration = (tenantName, room, phone) =>
    addNotification(
        'new_registration',
        `New resident: ${tenantName}`,
        `Registered in Room ${room} • ${phone}`,
        { tenantName, room, phone }
    );

export const notifyBulkInvoice = (count) =>
    addNotification(
        'bulk_notify',
        `Bulk invoices sent`,
        `Invoices sent to ${count} residents`,
        { count }
    );

export const notifyEBSplit = (room, perPerson, count) =>
    addNotification(
        'eb_split',
        `EB bill split — Room ${room}`,
        `₹${perPerson}/person for ${count} residents`,
        { room, perPerson, count }
    );
