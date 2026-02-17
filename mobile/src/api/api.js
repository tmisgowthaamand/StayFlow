import axios from 'axios';

const API_BASE_URL = 'https://stayflow-x8is.onrender.com/api/';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'x-api-key': 'stayflow_dev_key_123'
    }
});

export const getTenants = async () => {
    try {
        const response = await api.get('/tenants');
        return response.data;
    } catch (error) {
        console.error('Fetch tenants failed:', error.message);
        throw error;
    }
};

export const getDashboardStats = async () => {
    try {
        const response = await api.get('/dashboard-stats');
        return response.data;
    } catch (error) {
        console.error('Fetch stats failed:', error.message);
        throw error;
    }
};

export const notifyTenant = async (phone, name) => {
    try {
        const response = await api.post('/notify-tenant', { phone, name });
        return response.data;
    } catch (error) {
        console.error('Notify tenant failed:', error.message);
        throw error;
    }
};

export const updateEBBill = async (room, totalEB) => {
    try {
        const response = await api.post('/update-eb', { room, totalEB });
        return response.data;
    } catch (error) {
        console.error('Update EB failed:', error.message);
        throw error;
    }
};

export const markPaidManual = async (phone, name, amount, mode) => {
    try {
        const response = await api.post('/mark-paid', { phone, name, amount, mode });
        return response.data;
    } catch (error) {
        console.error('Mark paid failed:', error.message);
        throw error;
    }
};

export const addTenant = async (tenantData) => {
    try {
        const response = await api.post('/add-tenant', tenantData);
        return response.data;
    } catch (error) {
        console.error('Add tenant failed:', error.message);
        throw error;
    }
};

export const deleteTenant = async (phone, name) => {
    try {
        const response = await api.post('/delete-tenant', { phone, name });
        return response.data;
    } catch (error) {
        console.error('Delete tenant failed:', error.message);
        throw error;
    }
};

export const updateTenant = async (data) => {
    try {
        const response = await api.post('/update-and-notify', data);
        return response.data;
    } catch (error) {
        console.error('Update tenant failed:', error.message);
        throw error;
    }
};

export const sendAnnouncement = async (data, isMultipart = false) => {
    try {
        const config = isMultipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
        const payload = isMultipart ? data : { message: data };

        const response = await api.post('/announcement', payload, config);
        return response.data;
    } catch (error) {
        console.error('Announcement failed:', error.message);
        throw error;
    }
};

export const notifyAll = async () => {
    try {
        const response = await api.post('/trigger-notifications');
        return response.data;
    } catch (error) {
        console.error('Notify all failed:', error.message);
        throw error;
    }
};

export const registerPushToken = async (token, platform) => {
    try {
        const response = await api.post('/register-push-token', { token, platform });
        return response.data;
    } catch (error) {
        console.error('Register push token failed:', error.message);
        throw error;
    }
};


export const getBulkStatus = async () => {
    try {
        const response = await api.get('/bulk-status');
        return response.data;
    } catch (error) {
        console.error('Fetch bulk status failed:', error.message);
        throw error;
    }
};

export const generateInvoice = async (phone, name) => {
    try {
        const response = await api.post('/generate-invoice', { phone, name });
        return response.data;
    } catch (error) {
        console.error('Generate invoice failed:', error.message);
        throw error;
    }
};

export const getNotifications = async () => {
    try {
        const response = await api.get('/notifications');
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) return [];
        console.warn('Fetch notifications failed:', error.message);
        return [];
    }
};

export const getUnreadNotificationCount = async () => {
    try {
        const response = await api.get('/notifications/unread-count');
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) return { count: 0 };
        return { count: 0 };
    }
};

export const markNotificationsAsRead = async (id) => {
    try {
        const response = await api.post('/notifications/mark-read', { id });
        return response.data;
    } catch (error) {
        console.error('Mark read failed:', error.message);
        throw error;
    }
};

export const clearAllNotifications = async () => {
    try {
        const response = await api.delete('/notifications');
        return response.data;
    } catch (error) {
        console.error('Clear notifications failed:', error.message);
        throw error;
    }
};

export default api;

