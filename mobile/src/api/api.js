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

export default api;
