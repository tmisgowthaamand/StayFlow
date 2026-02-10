import 'dotenv/config';
import Groq from 'groq-sdk';

const config = {
    businessName: process.env.BUSINESS_NAME || 'StayFlow',
    upiId: process.env.OWNER_UPI_ID || 'ownername@upi',
    ownerPhone: process.env.OWNER_PHONE,
    rentDueDate: parseInt(process.env.MONTHLY_RENT_DUE_DATE || '5'),
    ebDueDate: parseInt(process.env.EB_DUE_DATE || '10'),
    ebUnitRate: parseInt(process.env.EB_UNIT_RATE || '15'),
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(','),
    googleFormUrl: process.env.GOOGLE_FORM_URL || 'https://stay-flow-kohl.vercel.app/register.html',
    whatsapp: {
        token: process.env.WHATSAPP_TOKEN,
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
        callbackUrl: process.env.WHATSAPP_CALLBACK_URL
    },
    sheets: {
        id: process.env.GOOGLE_SHEET_ID,
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: (() => {
            let key = process.env.GOOGLE_PRIVATE_KEY;
            if (!key) return null;

            // Remove outer quotes if present
            key = key.replace(/^["']|["']$/g, '');

            // Convert literal \n to actual newlines
            key = key.replace(/\\n/g, '\n');

            // Trim whitespace
            key = key.trim();

            console.log('Private key loaded. Len:', key.length, 'Lines:', key.split('\n').length);
            return key;
        })(),
    },
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/stayflow',
    groqApiKey: process.env.GROQ_API_KEY,
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    razorpay: {
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    },
    commands: {
        JOIN: 'JOIN',
        RENT: 'RENT',
        EB: 'EB',
        STATUS: 'STATUS',
        PAID: 'PAID',
        CASH_PAID: 'CASH PAID',
        VACATE: 'VACATE',
        LEAVE: 'LEAVE',
        HELP: 'HELP'
    }
};

export default config;
