import axios from 'axios';

const API_BASE_URL = 'https://stayflow-hnm3.onrender.com/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
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

export const broadcastMessage = async (data, isMultipart = false) => {
    try {
        const config = isMultipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
        // If not multipart, wrap message in object as backend expects { message: ... }
        const payload = isMultipart ? data : { message: data };

        const response = await api.post('/broadcast', payload, config);
        return response.data;
    } catch (error) {
        console.error('Broadcast failed:', error.message);
        throw error;
    }
};

export default api;
