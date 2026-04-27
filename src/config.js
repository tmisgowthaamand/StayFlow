import 'dotenv/config';

const config = {
    businessName: process.env.BUSINESS_NAME || 'StayFlow',
    upiId: process.env.OWNER_UPI_ID || 'ownername@upi',
    ownerPhone: process.env.OWNER_PHONE,
    rentDueDate: parseInt(process.env.MONTHLY_RENT_DUE_DATE || '5'),
    ebDueDate: parseInt(process.env.EB_DUE_DATE || '10'),
    ebUnitRate: parseInt(process.env.EB_UNIT_RATE || '15'),
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(','),
    googleFormUrl: process.env.GOOGLE_FORM_URL || 'https://stay-flow-kohl.vercel.app/register.html',
    renderApiUrl: process.env.RENDER_API_URL,
    whatsapp: {
        token: process.env.WHATSAPP_TOKEN,
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
        callbackUrl: process.env.WHATSAPP_CALLBACK_URL,
        appSecret: process.env.WHATSAPP_APP_SECRET
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

            return key;
        })(),
    },
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/stayflow',
    adminApiKey: process.env.ADMIN_API_KEY || 'stayflow_dev_key_123',
    jwtSecret: process.env.JWT_SECRET,
    adminPassword: process.env.ADMIN_PASSWORD,
    encryptionKey: process.env.ENCRYPTION_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    groqApiKey: process.env.GROQ_API_KEY,
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    razorpay: {
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
        webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET
    },
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET
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

// CRITICAL ENV VALIDATION (Operational Readiness)
const requiredEnv = [
    'MONGODB_URI',
    'GOOGLE_SHEET_ID',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_PRIVATE_KEY',
    'OWNER_PHONE',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
    'WHATSAPP_APP_SECRET',
    'JWT_SECRET',
    'ADMIN_PASSWORD',
    'ENCRYPTION_KEY'
];

const missing = requiredEnv.filter(key => !process.env[key]);
if (missing.length > 0) {
    console.error(`\n❌ FATAL: Missing Required Environment Variables:\n${missing.join('\n')}\n`);
    process.exit(1);
}

export default config;
