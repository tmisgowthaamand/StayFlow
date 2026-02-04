require('dotenv').config();
const Groq = require('groq-sdk');

module.exports = {
    businessName: process.env.BUSINESS_NAME || 'StayFlow',
    upiId: process.env.OWNER_UPI_ID || 'ownername@upi',
    ownerPhone: process.env.OWNER_PHONE,
    rentDueDate: parseInt(process.env.MONTHLY_RENT_DUE_DATE || '5'),
    ebDueDate: parseInt(process.env.EB_DUE_DATE || '10'),
    ebUnitRate: parseInt(process.env.EB_UNIT_RATE || '15'),
    googleFormUrl: process.env.GOOGLE_FORM_URL || 'https://blackheartedly-irenic-adeline.ngrok-free.dev/register.html',
    whatsapp: {
        token: process.env.WHATSAPP_TOKEN,
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
        callbackUrl: process.env.WHATSAPP_CALLBACK_URL
    },
    sheets: {
        id: process.env.GOOGLE_SHEET_ID,
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY
            ? process.env.GOOGLE_PRIVATE_KEY.trim().replace(/^"(.*)"$/, '$1').replace(/\\n/g, '\n')
            : null,
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
