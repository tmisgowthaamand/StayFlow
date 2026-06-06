import Constants from 'expo-constants';

// API Configuration with environment support
export const API_BASE_URL = 
    Constants.expoConfig?.extra?.apiUrl || 
    (__DEV__ 
        ? 'http://localhost:3000/api/' 
        : 'https://stayflow-tkto.onrender.com/api/');

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

console.log('[CONFIG] API Base URL:', API_BASE_URL);
console.log('[CONFIG] Environment:', __DEV__ ? 'DEVELOPMENT' : 'PRODUCTION');
