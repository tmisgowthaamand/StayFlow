import express from 'express';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

import config from './config.js';
import { handleIncomingMessage, sendMessage, sendMedia, setTenantContext, handleUpdateEB, createRazorpayLink, handleRazorpaySuccess } from './bot.js';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import setupCron from './cron.js';
import sheetsService from './sheets.js';
// WhatsApp Web.js disabled - using Cloud API only
// import wweb from './wweb.js';

const wweb = {
    ready: false,
    init: () => console.log('⚠️ WhatsApp Web.js disabled. Using Cloud API only.'),
    sendMessage: () => Promise.reject(new Error('WWeb not available')),
    sendImage: () => Promise.reject(new Error('WWeb not available'))
};
import pdfService from './pdfService.js';
import { Log, Media, Tenant, Notification, PushToken } from './db.js';
import { sendPushNotification } from './pushService.js';
import keepAliveService from './keepAlive.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NOTE: MongoDB sync is now handled automatically inside sheets.js
// Every call to sheetsService.updateTenant(), addTenant(), verifyPayment(), rejectPayment()
// auto-syncs to MongoDB. No need for separate sync calls.

const app = express();

app.use(cors({
    origin: (origin, callback) => {
        // If config.allowedOrigins is empty or has only empty strings, allow all
        const allowed = config.allowedOrigins.filter(o => o && o.trim() !== '');
        if (!origin || allowed.length === 0 || allowed.includes(origin) || allowed.includes('*')) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-api-key']
}));

// PHASE 2 REQ 7: Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP' }
});

const paymentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: 'Payment attempt limit reached.' }
});

app.use('/api/', apiLimiter);
app.use('/api/verify-transaction', paymentLimiter);
app.use('/api/mark-paid', paymentLimiter);
app.use('/api/razorpay-webhook', (req, res, next) => next()); // No limit on webhooks
app.use(bodyParser.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Authentication Middleware
const authenticate = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.key;
    if (!apiKey || apiKey !== config.adminApiKey) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
    }
    next();
};

// Serve dashboard, uploads, and public files statically
const dashboardDist = path.join(__dirname, '../dashboard/dist');
console.log(`Checking for dashboard build at: ${dashboardDist}`);

// 1. Prioritize modern dashboard
if (fs.existsSync(dashboardDist)) {
    console.log('✅ Dashboard found! Serving modern UI.');
    app.use(express.static(dashboardDist));
} else {
    console.warn('⚠️ Dashboard not found! Falling back to legacy UI.');
    console.log(`Contents of ../dashboard: ${fs.existsSync(path.join(__dirname, '../dashboard')) ? fs.readdirSync(path.join(__dirname, '../dashboard')).join(', ') : 'Not Found'}`);
}
// 2. Serve uploads as public for direct file access (hashed filenames provide security by obscurity)
app.use('/api/uploads', express.static(uploadsDir));

// 3. Serve public folder (registration, rules, etc)
app.use(express.static(path.join(__dirname, '../public')));

const port = process.env.PORT || 3000;

// Initialize Razorpay instance for order creation
let razorpayInstance = null;
if (config.razorpay.key_id && config.razorpay.key_secret) {
    try {
        razorpayInstance = new Razorpay({
            key_id: config.razorpay.key_id,
            key_secret: config.razorpay.key_secret,
        });
        console.log('✅ Razorpay initialized for payment orders');
        console.log(`   Key ID: ${config.razorpay.key_id.substring(0, 15)}...`);
        console.log(`   Secret: ${config.razorpay.key_secret.substring(0, 10)}... (length: ${config.razorpay.key_secret.length})`);
    } catch (rzpInitErr) {
        console.error('❌ Failed to initialize Razorpay:', rzpInitErr.message);
    }
} else {
    console.warn('⚠️ Razorpay credentials not configured');
    console.warn(`   Key ID: ${config.razorpay.key_id ? 'SET' : 'MISSING'}`);
    console.warn(`   Secret: ${config.razorpay.key_secret ? 'SET' : 'MISSING'}`);
}

// ==================== SIMPLE IN-MEMORY CACHE FOR PAYMENT INFO ====================
// Cache tenant data for 5 minutes to speed up payment page loads
const paymentInfoCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedPaymentInfo(phone) {
    const cached = paymentInfoCache.get(phone);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[CACHE HIT] Payment info for ${phone}`);
        return cached.data;
    }
    return null;
}

function setCachedPaymentInfo(phone, data) {
    paymentInfoCache.set(phone, { data, timestamp: Date.now() });
    // Auto-cleanup old entries
    if (paymentInfoCache.size > 100) {
        const oldestKey = paymentInfoCache.keys().next().value;
        paymentInfoCache.delete(oldestKey);
    }
}

function clearPaymentInfoCache(phone) {
    // Clear all cache entries for this phone (with or without name)
    for (const key of paymentInfoCache.keys()) {
        if (key.startsWith(phone + ':')) {
            paymentInfoCache.delete(key);
            console.log(`[CACHE CLEAR] Invalidated cache for ${key}`);
        }
    }
}

// ==================== PAYMENT PAGE APIs ====================

// GET /api/payment-info — Fetch tenant bill details for the payment page (OPTIMIZED WITH CACHE + MONGODB-FIRST)
app.get('/api/payment-info', async (req, res) => {
    try {
        const { phone, name } = req.query;
        if (!phone) return res.status(400).json({ error: 'Phone number is required' });

        // OPTIMIZATION 1: Check cache first (fastest)
        const cacheKey = `${phone}:${name || ''}`;
        const cached = getCachedPaymentInfo(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        // OPTIMIZATION 2: Try MongoDB SECOND for faster response (Sheets is slow)
        const cleanPhone = phone.replace(/\D/g, '');
        const mongoQuery = name 
            ? { phone: cleanPhone, name: { $regex: new RegExp(`^${name}$`, 'i') } }
            : { phone: cleanPhone };
        
        const mongoTenant = await Tenant.findOne(mongoQuery);
        
        if (mongoTenant) {
            console.log(`[PAYMENT-INFO] ⚡ Fast path: MongoDB hit for ${phone}`);
            const responseData = {
                name: mongoTenant.name || '',
                room: mongoTenant.room || 'N/A',
                rent: mongoTenant.monthlyRent || 0,
                eb: mongoTenant.ebAmount || 0,
                total: (mongoTenant.monthlyRent || 0) + (mongoTenant.ebAmount || 0),
                status: mongoTenant.status || 'PENDING',
                transactionId: '',
                paidDate: mongoTenant.paidDate || '',
                razorpayKeyId: config.razorpay.key_id || '',
                botNumber: '15551596475'
            };
            setCachedPaymentInfo(cacheKey, responseData);
            return res.json(responseData);
        }

        // OPTIMIZATION 3: Fallback to Sheets if not in MongoDB (new tenant or sync issue)
        console.log(`[PAYMENT-INFO] MongoDB miss, trying Sheets for ${phone}`);
        let tenant;
        try {
            tenant = await sheetsService.getTenantByPhone(phone, name);
        } catch (sheetsErr) {
            console.error('Sheets error in payment-info:', sheetsErr.message);
            throw new Error('Unable to fetch tenant data. Please try again later or contact admin.');
        }

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found. Please check your phone number or contact admin.' });
        }

        const tName = tenant.get('Name') || '';
        const tRoom = tenant.get('Room') || 'N/A';
        const tRent = parseFloat((tenant.get('Monthly Rent') || '0').toString().replace(/[^\d.]/g, ''));
        const tEB = parseFloat((tenant.get('EB Amount') || '0').toString().replace(/[^\d.]/g, ''));
        const tTotal = tRent + tEB;
        const tStatus = tenant.get('Status') || 'PENDING';

        const responseData = {
            name: tName,
            room: tRoom,
            rent: tRent,
            eb: tEB,
            total: tTotal,
            status: tStatus,
            transactionId: tenant.get('Transaction ID') || '',
            paidDate: tenant.get('Paid Date') || '',
            razorpayKeyId: config.razorpay.key_id || '',
            botNumber: '15551596475'
        };
        
        setCachedPaymentInfo(cacheKey, responseData);
        res.json(responseData);
    } catch (err) {
        console.error('Payment Info Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/create-order — Create a Razorpay Order for embedded checkout
app.post('/api/create-order', async (req, res) => {
    try {
        const { phone, name, room } = req.body;

        // Enhanced logging for debugging
        console.log(`[CREATE-ORDER] Request from ${phone}, Name: ${name}`);
        console.log(`[CREATE-ORDER] Razorpay Key ID: ${config.razorpay.key_id ? config.razorpay.key_id.substring(0, 15) + '...' : 'NOT SET'}`);
        console.log(`[CREATE-ORDER] Razorpay Secret: ${config.razorpay.key_secret ? 'SET (length: ' + config.razorpay.key_secret.length + ')' : 'NOT SET'}`);

        if (!razorpayInstance) {
            console.error('[CREATE-ORDER] ❌ Razorpay instance not initialized');
            return res.status(503).json({ 
                error: 'Payment gateway not configured. Please contact admin.',
                details: 'Razorpay credentials missing or invalid'
            });
        }

        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // FETCH ACTUAL AMOUNT FROM SHEETS TO PREVENT "PAY ₹1" EXPLOIT
        const tenant = await sheetsService.getTenantByPhone(phone, name);
        if (!tenant) {
            console.error(`[CREATE-ORDER] ❌ Tenant not found: ${phone}`);
            return res.status(404).json({ error: 'Resident record not found. Please contact admin.' });
        }

        const rent = parseFloat((tenant.get('Monthly Rent') || '0').toString().replace(/[^\d.]/g, ''));
        const eb = parseFloat((tenant.get('EB Amount') || '0').toString().replace(/[^\d.]/g, ''));
        const actualTotal = rent + eb;

        if (actualTotal <= 0) {
            return res.status(400).json({ error: 'No pending dues found for this resident.' });
        }

        const amountInPaise = Math.round(actualTotal * 100);

        console.log(`[CREATE-ORDER] Creating order for ₹${actualTotal} (${amountInPaise} paise)`);

        let order;
        try {
            order = await razorpayInstance.orders.create({
                amount: amountInPaise,
                currency: 'INR',
                receipt: `SF-${phone.slice(-4)}-${Date.now().toString().slice(-6)}`,
                notes: {
                    phone: phone,
                    tenant_name: tenant.get('Name') || 'Tenant',
                    room: tenant.get('Room') || 'N/A'
                }
            });
        } catch (rzpErr) {
            console.error('[CREATE-ORDER] ❌ Razorpay API Error:', rzpErr.message);
            console.error('[CREATE-ORDER] Error details:', rzpErr.error || rzpErr);
            
            // Check if it's an authentication error
            if (rzpErr.statusCode === 401 || rzpErr.message.includes('authentication') || rzpErr.message.includes('Authentication')) {
                return res.status(401).json({ 
                    error: 'Payment gateway authentication failed. Please contact admin.',
                    details: 'Invalid Razorpay credentials. Admin needs to update RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Render environment variables.'
                });
            }
            
            throw rzpErr;
        }

        console.log(`[RAZORPAY ORDER] ✅ Created: ${order.id} for ${phone} | ₹${actualTotal}`);

        res.json({
            orderId: order.id,
            amount: amountInPaise,
            currency: 'INR',
            razorpayKeyId: config.razorpay.key_id
        });
    } catch (err) {
        console.error('[CREATE-ORDER] ❌ Error:', err.message);
        res.status(500).json({ error: 'Failed to create payment order: ' + err.message });
    }
});

// POST /api/verify-razorpay-payment — Verify Razorpay payment signature & process
app.post('/api/verify-razorpay-payment', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, phone } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: 'Missing payment verification data' });
        }

        // Verify signature using HMAC SHA256
        const generatedSignature = crypto
            .createHmac('sha256', config.razorpay.key_secret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            console.error(`[VERIFY PAYMENT] Signature mismatch for ${razorpay_payment_id}`);
            return res.status(400).json({ success: false, error: 'Payment signature verification failed' });
        }

        console.log(`[VERIFY PAYMENT] ✅ Signature verified: ${razorpay_payment_id}`);

        // Log the verified payment
        await Log.create({
            action: 'RAZORPAY_PAYMENT_VERIFIED',
            phone: phone,
            details: { razorpay_order_id, razorpay_payment_id, razorpay_signature },
            timestamp: new Date()
        });

        // Fetch payment details from Razorpay to get amount and UPI ID
        let paymentAmount = 0;
        let rzpDetails = {};
        try {
            const auth = Buffer.from(`${config.razorpay.key_id}:${config.razorpay.key_secret}`).toString('base64');
            const rzpRes = await axios.get(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
                headers: { 'Authorization': `Basic ${auth}` }
            });
            paymentAmount = (rzpRes.data.amount || 0) / 100;
            rzpDetails = {
                vpa: rzpRes.data.vpa || rzpRes.data.acquirer_data?.rrn || '',
                payment_id: razorpay_payment_id,
                order_id: razorpay_order_id,
                method: rzpRes.data.method || 'upi'
            };
        } catch (fetchErr) {
            console.error('Failed to fetch payment amount:', fetchErr.message);
        }

        // Process the successful payment
        if (phone) {
            await handleRazorpaySuccess(phone, paymentAmount, razorpay_payment_id, 'UPI (Razorpay)', rzpDetails);
            // Clear cache for this phone to ensure fresh data on next payment page load
            clearPaymentInfoCache(phone);
        }

        res.json({
            success: true,
            paymentId: razorpay_payment_id,
            amount: paymentAmount,
            vpa: rzpDetails.vpa
        });
    } catch (err) {
        console.error('Verify Payment Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});


// Webhook Verification (for setup)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// Handling incoming messages
app.post('/webhook', async (req, res) => {
    // P1: WhatsApp Webhook Signature Verification
    const signature = req.headers['x-hub-signature-256'];
    if (config.whatsapp.appSecret && signature) {
        const expectedSignature = 'sha256=' + crypto
            .createHmac('sha256', config.whatsapp.appSecret)
            .update(JSON.stringify(req.body))
            .digest('hex');
        if (signature !== expectedSignature) {
            console.warn('❌ WhatsApp Webhook signature verification failed');
            return res.sendStatus(403);
        }
    }

    const body = req.body;
    fs.appendFileSync('debug.log', `[${new Date().toISOString()}] Webhook received: ${JSON.stringify(body)}\n`);

    if (body.object === 'whatsapp_business_account') {
        if (
            body.entry &&
            body.entry[0].changes &&
            body.entry[0].changes[0].value.messages &&
            body.entry[0].changes[0].value.messages[0]
        ) {
            const msg = body.entry[0].changes[0].value.messages[0];
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] Formatted Msg: ${JSON.stringify(msg)}\n`);
            const phone = msg.from;
            let text = msg.text ? msg.text.body : '';
            const image = msg.image ? msg.image : null;

            // Handle interactive button replies
            if (msg.type === 'interactive' && msg.interactive.button_reply) {
                text = msg.interactive.button_reply.title;
            }

            // Handle interactive list replies (menu selections)
            if (msg.type === 'interactive' && msg.interactive.list_reply) {
                const listId = msg.interactive.list_reply.id || '';
                const listTitle = msg.interactive.list_reply.title || '';
                // Use the ID (e.g., 'menu_rent', 'stmt_2026_2') for routing
                text = listId.toUpperCase();
                console.log(`List selection from ${phone}: ID=${listId}, Title=${listTitle}`);
            }

            if (text || image) {
                console.log(`Received ${image ? 'image' : (msg.type === 'interactive' ? 'interactive' : 'message')} from ${phone}: ${text}`);
                await handleIncomingMessage(phone, text, msg.id, image);
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// ==================== RAZORPAY WEBHOOK ====================
// Receives payment confirmation from Razorpay — Auto-verifies payment
app.post('/webhook/razorpay', async (req, res) => {
    try {
        const payload = req.body;
        console.log('Razorpay Webhook Received:', JSON.stringify(payload));

        // Log the webhook payload for verification later
        await Log.create({
            action: 'RAZORPAY_WEBHOOK',
            details: payload,
            timestamp: new Date()
        });

        // Verify webhook signature (Mandatory in Production)
        const signature = req.headers['x-razorpay-signature'];
        if (!signature) {
            console.warn('⚠️ Webhook received without signature');
            return res.status(400).send('Signature missing');
        }

        const expectedSignature = crypto
            .createHmac('sha256', config.razorpay.key_secret || '')
            .update(JSON.stringify(payload))
            .digest('hex');

        if (signature !== expectedSignature) {
            console.warn('❌ Webhook signature verification failed');
            return res.status(400).send('Invalid signature');
        }
        console.log('✅ Webhook signature verified');

        // Process payment.captured event
        if (payload.event === 'payment_link.paid' || payload.event === 'payment.captured') {
            const paymentEntity = payload.payload?.payment?.entity || payload.payload?.payment_link?.entity || {};
            const notes = paymentEntity.notes || {};
            const phone = notes.phone || '';
            const amount = (paymentEntity.amount || 0) / 100; // Convert paise to rupees
            const trxId = paymentEntity.id || `RZP-${Date.now().toString().slice(-6)}`;
            const vpa = paymentEntity.vpa || paymentEntity.acquirer_data?.rrn || '';
            const order_id = paymentEntity.order_id || '';

            if (phone) {
                await handleRazorpaySuccess(phone, amount, trxId, 'UPI (Razorpay)', {
                    vpa,
                    payment_id: trxId,
                    order_id
                });
                console.log(`Razorpay payment verified for ${phone}: ₹${amount}, TXN: ${trxId}, VPA: ${vpa}`);
            } else {
                console.error('Razorpay webhook: No phone number in payment notes');
            }
        }

        res.status(200).json({ status: 'ok' });
    } catch (err) {
        console.error('Razorpay Webhook Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ==================== TRANSACTION VERIFICATION API ====================
// Called from confirmation.html to verify a transaction ID
app.post('/api/verify-transaction', async (req, res) => {
    try {
        let { phone, trxId } = req.body;
        if (!trxId) return res.status(400).json({ error: 'Transaction ID is required' });

        // Clean Transaction ID (remove whitespace, common prefixes if user added them)
        trxId = trxId.trim();
        console.log(`[VERIFY] TRX: ${trxId} | Phone: ${phone}`);

        // 1. Check Google Sheets Records First
        const tenants = await sheetsService.getAllTenants();
        const tenant = tenants.find(t => {
            const sheetPhone = t.get('Phone');
            const normalizedSheetPhone = sheetsService.normalizePhone ? sheetsService.normalizePhone(sheetPhone) : sheetPhone?.toString().replace(/\D/g, '');
            const normalizedTargetPhone = sheetsService.normalizePhone ? sheetsService.normalizePhone(phone) : phone?.toString().replace(/\D/g, '');
            return normalizedSheetPhone === normalizedTargetPhone;
        });

        if (tenant) {
            const sheetStatus = tenant.get('Status');
            const sheetTrxId = tenant.get('Transaction ID');
            console.log(`[VERIFY] Found tenant: ${tenant.get('Name')} | Status: ${sheetStatus} | Sheet TRX: ${sheetTrxId}`);

            // If already PAID, and TRX matches, consider it success
            if (sheetStatus === 'PAID' && (sheetTrxId === trxId || trxId === sheetTrxId)) {
                console.log(`[VERIFY] Tenant already marked PAID. Proceeding.`);
                const tName = tenant.get('Name') || '';
                const tRoom = tenant.get('Room') || 'N/A';
                const tRent = tenant.get('Monthly Rent') || '0';
                const tEB = tenant.get('EB Amount') || '0';
                const tTotal = (parseFloat(tRent) + parseFloat(tEB)) || tenant.get('Total Amount') || '0';
                const tTrxId = tenant.get('Transaction ID') || trxId;
                const tPaidDate = tenant.get('Paid Date') || new Date().toLocaleDateString();
                const tVpa = tenant.get('UPI ID') || ''; // Check if we stored it in sheets
                // Generate invoice URL for download
                let invoiceUrl = '';
                try {
                    const invData = {
                        Name: tName, Phone: phone, Room: tRoom,
                        EB_Amount: tEB, Monthly_Rent: tRent, Total_Amount: tTotal.toString(),
                        Paid_Date: tPaidDate, Transaction_ID: tTrxId, Payment_Mode: 'UPI (Razorpay)',
                        UPI_ID: tVpa
                    };
                    const { fileName } = await pdfService.generateInvoice(invData);
                    invoiceUrl = `/api/uploads/${fileName}`;
                } catch (pdfErr) { console.error('Invoice gen error:', pdfErr.message); }
                return res.json({
                    success: true,
                    message: 'Payment Verified',
                    botNumber: '15551596475',
                    tenantPhone: phone,
                    tenantName: tName,
                    room: tRoom,
                    rent: tRent,
                    eb: tEB,
                    total: tTotal,
                    trxId: tTrxId,
                    paidDate: tPaidDate,
                    invoiceUrl: invoiceUrl,
                    vpa: tVpa
                });
            }
        }

        // 2. Check Razorpay Webhook Data in MongoDB logs (STRICT PHONE + TRX MATCH)
        const webhookLog = await Log.findOne({
            action: 'RAZORPAY_WEBHOOK',
            $and: [
                {
                    $or: [
                        { 'details.payload.payment.entity.notes.phone': phone },
                        { 'details.payload.payment_link.entity.notes.phone': phone }
                    ]
                },
                {
                    $or: [
                        { 'details.payload.payment.entity.id': { $regex: trxId, $options: 'i' } },
                        { 'details.payload.payment_link.entity.id': { $regex: trxId, $options: 'i' } },
                        { 'details.payload.payment.entity.acquirer_data.rrn': trxId },
                        { 'details.payload.payment.entity.acquirer_data.upi_transaction_id': trxId },
                        { 'details.payload.payment.entity.vpa': trxId }
                    ]
                }
            ]
        }).sort({ timestamp: -1 });

        if (webhookLog) {
            console.log(`[VERIFY] Found matching Razorpay webhook in logs`);
            const payload = webhookLog.details;
            const paymentEntity = payload.payload?.payment?.entity || payload.payload?.payment_link?.entity || {};
            const notes = paymentEntity.notes || {};
            const targetPhone = phone || notes.phone || '';
            const amount = (paymentEntity.amount || 0) / 100;
            // Use the provided trxId as the one to record if it matched something
            const finalTrxId = paymentEntity.id || trxId;

            if (targetPhone) {
                const vpa = paymentEntity.vpa || paymentEntity.acquirer_data?.rrn || '';
                const order_id = paymentEntity.order_id || '';

                await handleRazorpaySuccess(targetPhone, amount, finalTrxId, 'UPI (Razorpay)', {
                    vpa,
                    payment_id: finalTrxId,
                    order_id
                });
                // Fetch updated tenant for response details
                const updatedTenant = await sheetsService.getTenantByPhone(targetPhone);
                let invoiceUrl = '';
                let tName = '', tRoom = 'N/A', tRent = '0', tEB = '0';
                if (updatedTenant) {
                    tName = updatedTenant.get('Name') || '';
                    tRoom = updatedTenant.get('Room') || 'N/A';
                    tRent = updatedTenant.get('Monthly Rent') || '0';
                    tEB = updatedTenant.get('EB Amount') || '0';
                    try {
                        const { fileName } = await pdfService.generateInvoice({
                            Name: tName, Phone: targetPhone, Room: tRoom,
                            EB_Amount: tEB, Monthly_Rent: tRent, Total_Amount: amount.toString(),
                            Paid_Date: new Date().toLocaleDateString(), Transaction_ID: finalTrxId, Payment_Mode: 'UPI (Razorpay)',
                            UPI_ID: vpa, Payment_ID: finalTrxId, Order_ID: order_id
                        });
                        invoiceUrl = `/api/uploads/${fileName}`;
                    } catch (e) { }
                }
                return res.json({
                    success: true, botNumber: '15551596475',
                    tenantPhone: targetPhone, tenantName: tName, room: tRoom,
                    rent: tRent, eb: tEB, total: amount, trxId: finalTrxId,
                    paidDate: new Date().toLocaleDateString(), invoiceUrl,
                    vpa, paymentId: finalTrxId, orderId: order_id
                });
            }
        }

        // 3. Direct Razorpay API Lookup
        if (config.razorpay.key_id && config.razorpay.key_secret) {
            const auth = Buffer.from(`${config.razorpay.key_id}:${config.razorpay.key_secret}`).toString('base64');
            const headers = { 'Authorization': `Basic ${auth}` };

            // Check if it's a payment
            try {
                const rzpResponse = await axios.get(`https://api.razorpay.com/v1/payments/${trxId}`, { headers });
                if (rzpResponse.data && (rzpResponse.data.status === 'captured' || rzpResponse.data.status === 'authorized')) {
                    console.log(`[VERIFY] Verified via Razorpay Payment API: ${trxId}`);
                    const rzpPayment = rzpResponse.data;
                    const targetPhone = phone || rzpPayment.notes?.phone || '';
                    if (targetPhone) {
                        const rzpAmount = rzpPayment.amount / 100;
                        const rzpVpa = rzpPayment.vpa || rzpPayment.acquirer_data?.rrn || '';

                        await handleRazorpaySuccess(targetPhone, rzpAmount, trxId, 'UPI (Razorpay)', {
                            vpa: rzpVpa,
                            payment_id: rzpPayment.id,
                            order_id: rzpPayment.order_id
                        });
                        const uTenant = await sheetsService.getTenantByPhone(targetPhone);
                        let invoiceUrl = '';
                        if (uTenant) {
                            try {
                                const { fileName } = await pdfService.generateInvoice({
                                    Name: uTenant.get('Name'), Phone: targetPhone, Room: uTenant.get('Room') || 'N/A',
                                    EB_Amount: uTenant.get('EB Amount') || '0', Monthly_Rent: uTenant.get('Monthly Rent') || '0',
                                    Total_Amount: rzpAmount.toString(), Paid_Date: new Date().toLocaleDateString(),
                                    Transaction_ID: trxId, Payment_Mode: 'UPI (Razorpay)',
                                    UPI_ID: rzpVpa, Payment_ID: rzpPayment.id, Order_ID: rzpPayment.order_id
                                });
                                invoiceUrl = `/api/uploads/${fileName}`;
                            } catch (e) { }
                        }
                        return res.json({
                            success: true, botNumber: '15551596475',
                            tenantPhone: targetPhone, tenantName: uTenant?.get('Name') || '',
                            room: uTenant?.get('Room') || 'N/A', rent: uTenant?.get('Monthly Rent') || '0',
                            eb: uTenant?.get('EB Amount') || '0', total: rzpAmount, trxId,
                            paidDate: new Date().toLocaleDateString(), invoiceUrl,
                            vpa: rzpPayment.vpa || rzpPayment.acquirer_data?.rrn || '',
                            paymentId: rzpPayment.id,
                            orderId: rzpPayment.order_id
                        });
                    }
                }
            } catch (pErr) { /* ignore 404 */ }

            // Check if it's a payment link
            try {
                const rzpLinkResponse = await axios.get(`https://api.razorpay.com/v1/payment_links/${trxId}`, { headers });
                if (rzpLinkResponse.data && rzpLinkResponse.data.status === 'paid') {
                    console.log(`[VERIFY] Verified via Razorpay Payment Link API: ${trxId}`);
                    const rzpLink = rzpLinkResponse.data;
                    const targetPhone = phone || rzpLink.notes?.phone || '';
                    if (targetPhone) {
                        const linkAmount = rzpLink.amount_paid / 100;
                        // For payment links, we might need to fetch the actual payment to get the VPA
                        let linkVpa = '';
                        try {
                            const paymentsRes = await axios.get(`https://api.razorpay.com/v1/payment_links/${trxId}/payments`, { headers });
                            if (paymentsRes.data.items && paymentsRes.data.items.length > 0) {
                                linkVpa = paymentsRes.data.items[0].vpa || '';
                            }
                        } catch (e) { }

                        await handleRazorpaySuccess(targetPhone, linkAmount, trxId, 'UPI (Razorpay)', { vpa: linkVpa, payment_id: trxId, order_id: rzpLink.order_id });
                        const lTenant = await sheetsService.getTenantByPhone(targetPhone);
                        let invoiceUrl = '';
                        if (lTenant) {
                            try {
                                const { fileName } = await pdfService.generateInvoice({
                                    Name: lTenant.get('Name'), Phone: targetPhone, Room: lTenant.get('Room') || 'N/A',
                                    EB_Amount: lTenant.get('EB Amount') || '0', Monthly_Rent: lTenant.get('Monthly Rent') || '0',
                                    Total_Amount: linkAmount.toString(), Paid_Date: new Date().toLocaleDateString(),
                                    Transaction_ID: trxId, Payment_Mode: 'UPI (Razorpay)',
                                    UPI_ID: linkVpa, Payment_ID: trxId, Order_ID: rzpLink.order_id
                                });
                                invoiceUrl = `/api/uploads/${fileName}`;
                            } catch (e) { }
                        }
                        return res.json({
                            success: true, botNumber: '15551596475',
                            tenantPhone: targetPhone, tenantName: lTenant?.get('Name') || '',
                            room: lTenant?.get('Room') || 'N/A', rent: lTenant?.get('Monthly Rent') || '0',
                            eb: lTenant?.get('EB Amount') || '0', total: linkAmount, trxId,
                            paidDate: new Date().toLocaleDateString(), invoiceUrl,
                            vpa: linkVpa, paymentId: trxId, orderId: rzpLink.order_id
                        });
                    }
                }
            } catch (lErr) { /* ignore 404 */ }
        }

        // 4. Final Fallback: If we have a tenant for this phone, and they provided A valid-looking ID, 
        // AND we are in test mode OR just want to be helpful, we can check if it matches the SHEET's Transaction ID
        if (tenant && tenant.get('Transaction ID') === trxId) {
            const fbName = tenant.get('Name') || '';
            const fbRoom = tenant.get('Room') || 'N/A';
            const fbRent = tenant.get('Monthly Rent') || '0';
            const fbEB = tenant.get('EB Amount') || '0';
            const fbTotal = parseFloat(fbRent) + parseFloat(fbEB);
            return res.json({
                success: true,
                message: 'Payment Verified',
                botNumber: '15551596475',
                tenantPhone: phone, tenantName: fbName, room: fbRoom,
                rent: fbRent, eb: fbEB, total: fbTotal, trxId,
                paidDate: tenant.get('Paid Date') || new Date().toLocaleDateString()
            });
        }

        console.warn(`Transaction NOT found after all checks: ${trxId}`);
        res.status(404).json({
            success: false,
            error: 'Transaction ID not found. Please contact support.',
            botNumber: '15551596475'
        });
    } catch (err) {
        console.error('Verify Transaction Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Redundant notification routes removed (already at the bottom)


// Initialize WWeb for Free Automation (Optional - Falls back to Cloud API if Chrome not found)
try {
    wweb.init();
} catch (err) {
    console.warn('⚠️ WhatsApp Web.js initialization skipped:', err.message);
    console.log('✅ Using WhatsApp Cloud API only');
}

// Proxy for WhatsApp Media
// Proxy for WhatsApp Media
app.get('/api/media/:id', authenticate, async (req, res) => {
    try {
        const mediaId = req.params.id;
        const safeMediaId = path.basename(mediaId);
        const localPath = path.join(uploadsDir, safeMediaId);

        console.log(`Media Request: ${safeMediaId}`);

        // 1. Try serving from local disk (unless refresh is requested)
        if (!req.query.refresh && fs.existsSync(localPath) && fs.lstatSync(localPath).isFile()) {
            console.log(`Serving local media: ${safeMediaId}`);
            const ext = path.extname(safeMediaId).toLowerCase();
            if (!ext) {
                if (/^[a-f0-9]{32}$/i.test(safeMediaId) || safeMediaId.startsWith('wweb_')) {
                    res.setHeader('Content-Type', 'image/jpeg');
                }
            }
            return res.sendFile(localPath);
        }

        // 2. FALLBACK: On-the-fly PDF Regeneration if missing on disk (common after redeploy)
        if (safeMediaId.startsWith('registration_') || safeMediaId.startsWith('invoice_')) {
            console.log(`PDF missing on disk, attempting to regenerate: ${safeMediaId}`);
            try {
                // Filename pattern: prefix_phone_timestamp.pdf
                const parts = safeMediaId.split('_');
                if (parts.length >= 2) {
                    const phone = parts[1];
                    await sheetsService.init();
                    const tenant = await sheetsService.getTenantByPhone(phone);

                    if (tenant) {
                        console.log(`Regenerating ${parts[0]} for ${tenant.get('Name')} (${phone})`);
                        if (parts[0] === 'registration') {
                            await pdfService.generateRegistrationForm({
                                fileName: safeMediaId,
                                name: tenant.get('Name'),
                                phone: tenant.get('Phone'),
                                room: tenant.get('Room') || 'Pending',
                                sharingType: tenant.get('Sharing Type') || 'N/A',
                                advance: tenant.get('Advance') || '0',
                                monthlyRent: tenant.get('Monthly Rent') || '0'
                            });
                        } else if (parts[0] === 'invoice') {
                            await pdfService.generateInvoice({
                                fileName: safeMediaId,
                                Name: tenant.get('Name'),
                                Phone: tenant.get('Phone'),
                                Room: tenant.get('Room') || 'N/A',
                                EB_Amount: tenant.get('EB Amount') || '0',
                                Monthly_Rent: tenant.get('Monthly Rent') || '0',
                                Total_Amount: tenant.get('Total Amount') || '0',
                                Paid_Date: tenant.get('Paid Date') || 'PENDING',
                                Transaction_ID: tenant.get('Transaction ID') || 'PENDING',
                                Payment_Mode: tenant.get('Payment Mode') || 'Pending'
                            });
                        }

                        // Verify it was created and serve it
                        if (fs.existsSync(localPath)) {
                            console.log(`Successfully regenerated and serving: ${safeMediaId}`);
                            return res.sendFile(localPath);
                        }
                    }
                }
            } catch (regErr) {
                console.error(`Regeneration failed for ${safeMediaId}:`, regErr.message);
            }
        }

        // 3. Try fetching from WhatsApp (ONLY if it looks like a WhatsApp media ID)
        // WhatsApp IDs are numeric strings. Local filenames (with extensions) or hashes should not be proxied to WhatsApp.
        const isWhatsAppId = /^\d+$/.test(mediaId) || mediaId.startsWith('wweb_');

        if (isWhatsAppId) {
            console.log(`Fetching remote media from WhatsApp: ${mediaId}`);
            try {
                const urlRes = await axios.get(`https://graph.facebook.com/v17.0/${mediaId}`, {
                    headers: { Authorization: `Bearer ${config.whatsapp.token}` }
                });

                const mediaUrl = urlRes.data.url;
                const mediaRes = await axios.get(mediaUrl, {
                    headers: { Authorization: `Bearer ${config.whatsapp.token}` },
                    responseType: 'stream'
                });

                res.setHeader('Content-Type', mediaRes.headers['content-type']);
                return mediaRes.data.pipe(res);
            } catch (whatsappErr) {
                console.error(`WhatsApp Media Fetch Failed for ${mediaId}:`, whatsappErr.message);
                return res.status(404).send(`Media document [${mediaId}] not found on WhatsApp servers.`);
            }
        }

        // 4. Default 404 if everything failed
        console.warn(`Media NOT found: ${safeMediaId}`);
        res.status(404).send(`Media document [${safeMediaId}] not found on server. If this was a web upload, it may have been cleared by a server restart/redeploy. Please re-upload it via the resident edit profile.`);
    } catch (err) {
        console.error(`Media proxy error for ${req.params.id}:`, err.message);
        res.status(500).send('Error loading media: ' + err.message);
    }
});

app.post('/api/update-eb', authenticate, async (req, res) => {
    try {
        const { room, totalEB } = req.body;
        await handleUpdateEB(config.ownerPhone, room, totalEB);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/bulk-update-eb — Bulk update EB amounts for multiple tenants (Monthly Billing tab)
app.post('/api/bulk-update-eb', authenticate, async (req, res) => {
    try {
        const { updates } = req.body;  // [{ phone, name, eb }]
        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        let successCount = 0;
        let failCount = 0;
        const errors = [];

        for (const update of updates) {
            try {
                const tenant = await sheetsService.getTenantByPhone(update.phone, update.name);
                if (!tenant) {
                    failCount++;
                    errors.push(`${update.name || update.phone}: Tenant not found`);
                    continue;
                }

                const rent = parseFloat((tenant.get('Monthly Rent') || '0').toString().replace(/[^\d.]/g, ''));
                const eb = parseFloat((update.eb || '0').toString().replace(/[^\d.]/g, ''));
                const total = rent + eb;

                // 1. Update Google Sheets (Auto-syncs to MongoDB)
                await sheetsService.updateTenant(update.phone, {
                    'EB Amount': eb.toString(),
                    'Total Amount': total.toString()
                }, update.name);

                successCount++;
            } catch (updateErr) {
                failCount++;
                errors.push(`${update.name || update.phone}: ${updateErr.message}`);
            }
        }

        console.log(`[BULK EB] Updated ${successCount}/${updates.length} tenants (Sheets + Mongo). Failures: ${failCount}`);

        res.json({
            success: true,
            updated: successCount,
            failed: failCount,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (err) {
        console.error('Bulk EB Update Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// PHASE 2 REQ 5: Secure File Uploads
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB Limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) return cb(null, true);
        cb(new Error('Only JPEG, PNG and PDF files are allowed!'));
    }
});

app.post('/api/upload-aadhaar', authenticate, upload.single('aadhaar'), async (req, res) => {
    try {
        const { phone } = req.body;
        const file = req.file;
        if (!file || !phone) return res.status(400).json({ error: 'File and phone required' });

        await sheetsService.updateTenant(phone, {
            'Aadhaar Image': file.filename
        });

        res.json({ success: true, filename: file.filename });
    } catch (err) {
        console.error('File Upload Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// New /register route to serve the registration page
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/register.html'));
});

// Serve queries form
app.get('/queries', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/queries.html'));
});

// API to submit a query from the queries form
app.post('/api/submit-query', async (req, res) => {
    try {
        const { name, phone, room, category, description } = req.body;
        if (!name || !phone || !description) {
            return res.status(400).json({ error: 'Name, phone and description are required' });
        }

        // Log to MongoDB
        await Log.create({
            phone,
            action: 'QUERY_SUBMITTED',
            details: { name, room, category, description, timestamp: new Date().toISOString() }
        });

        // Send confirmation to the user via WhatsApp
        await sendMessage(phone, `\u2705 *Query Received!*\n\n\ud83d\udccb Category: ${category || 'General'}\n\ud83d\udcdd Issue: "${description}"\n\nOur team will review and get back to you shortly. Thank you for your patience! \ud83d\ude4f`);

        // Notify admin
        if (config.ownerPhone) {
            await sendMessage(config.ownerPhone, `\ud83c\udd98 *New Query Received*\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\ud83d\udc64 Name: ${name}\n\ud83d\udcde Phone: ${phone}\n\ud83d\udeaa Room: ${room || 'N/A'}\n\ud83d\udccb Category: ${category || 'General'}\n\ud83d\udcdd Query: ${description}\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n_Reply to ${phone} directly to respond._`);
        }

        // 🔔 Create In-App Notification
        try {
            const title = `🚩 New Issue: ${category || 'General'}`;
            const body = `${name} (Room ${room || 'N/A'}): ${description.slice(0, 50)}${description.length > 50 ? '...' : ''}`;

            await Notification.create({
                type: 'issue_submitted',
                title,
                body,
                meta: { tenantName: name, room, category, issue: description, phone }
            });

            // 🚀 Send Remote Push Notification (Drop-down)
            await sendPushNotification(title, body, { type: 'issue_submitted', tenantName: name, room, category });
        } catch (e) {
            console.error('Failed to create in-app notification:', e.message);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Query submit error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Serve modern dashboard at /admin and /
app.get('/admin', (req, res) => {
    if (fs.existsSync(path.join(dashboardDist, 'index.html'))) {
        res.sendFile(path.join(dashboardDist, 'index.html'));
    } else {
        res.sendFile(path.join(__dirname, '../public/legacy.html'));
    }
});

app.post('/api/web-register', upload.single('aadhaar'), async (req, res) => {
    try {
        const { name, phone, room, sharing, advance } = req.body;
        const file = req.file;

        console.log(`Web Registration: ${name} (${phone})`);

        const detailedRules = `🏢 *PG House Rules & Regulations*\n━━━━━━━━━━━━━━━━━━━━\n⚖️ *DO's:*\n1. Keep your room and shared areas clean and hygienic.\n2. Maintain silence after 10:00 PM for everyone's comfort.\n3. Pay rent by the 5th and EB bills by the 10th of each month.\n4. Inform the admin 30 days before vacating.\n5. Cooperate with police verification and security checks.\n\n🚫 *DON'Ts:*\n1. Strictly NO smoking, alcohol, or illegal substances.\n2. No overnight visitors allowed without prior permission.\n3. Do not use heavy appliances (Heaters/AC/Iron) without approval.\n4. No loud music, parties, or disturbances in rooms.\n5. Do not damage PG property or furniture.\n\n📜 *Note:* Rules are for the safety and comfort of all residents.\n━━━━━━━━━━━━━━━━━━━━`;

        const { fileName: regFile, filePath: regPath } = await pdfService.generateRegistrationForm({
            name, phone, room, sharingType: sharing, advance, monthlyRent: '0'
        });

        await sheetsService.init();
        await sheetsService.addTenant({
            name,
            phone,
            room,
            sharingType: sharing,
            advance,
            monthlyRent: '0',
            aadhaarImage: file ? file.filename : '',
            registrationForm: regFile
        });

        await sendMessage(phone, `✅ *Registration Successful!* 🎉\n\nWelcome ${name} to Room ${room}. We are happy to have you! 🏠\n\n${detailedRules}\n\n🤖 *How to Use:* Type *HI* anytime to see your dashboard!`);
        await sendMedia(phone, regPath, '📄 Your registration copy', null, 'StayFlow_Registration.pdf');

        if (config.ownerPhone) {
            await sendMessage(config.ownerPhone, `📝 *New Web Registration*\n${name} - ${room}\nPhone: ${phone}\nAdvance: ₹${advance}`);
            await sendMedia(config.ownerPhone, regPath, `📝 Registration copy: ${name}`, null, 'StayFlow_Registration.pdf');
        }

        res.redirect('/rules.html');
    } catch (err) {
        console.error('Web Reg Error:', err);
        res.status(500).send('Registration Failed: ' + err.message);
    }
});

/**
 * Public AJAX Registration Endpoint
 * Used by the modern registration form in dashboard/public/register.html
 */
app.post('/api/public/register', upload.single('aadhaar'), async (req, res) => {
    try {
        const { name, phone, location, sharingType, room, rent, advance } = req.body;
        const file = req.file;

        if (!name || !phone) {
            return res.status(400).json({ error: 'Name and phone are required' });
        }

        console.log(`[PUBLIC REG] Received registration request for ${name} (${phone})`);

        // 1. Generate Registration Form PDF
        const { fileName: regFile, filePath: regPath } = await pdfService.generateRegistrationForm({
            name,
            phone,
            room: room || 'Pending',
            sharingType: sharingType || 'N/A',
            advance: advance || '0',
            monthlyRent: rent || '0'
        });

        // 2. Add to Google Sheets (and MongoDB via auto-sync)
        await sheetsService.init();
        const tenantData = {
            name,
            phone,
            location: location || 'Main Branch',
            sharingType: sharingType || 'N/A',
            room: room || 'Pending',
            monthlyRent: rent || '0',
            advance: advance || '0',
            aadhaarImage: file ? file.filename : '',
            registrationForm: regFile
        };

        await sheetsService.addTenant(tenantData);

        // 3. Send WhatsApp Confirmation
        const detailedRules = `🏢 *PG House Rules & Regulations*\n━━━━━━━━━━━━━━━━━━━━\n⚖️ *DO's:*\n1. Keep your room and shared areas clean and hygienic.\n2. Maintain silence after 10:00 PM for everyone's comfort.\n3. Pay rent by the 5th and EB bills by the 10th of each month.\n\n🚫 *DON'Ts:*\n1. Strictly NO smoking, alcohol, or illegal substances.\n2. No overnight visitors allowed without prior permission.\n\n🤖 *Tip:* Type *HI* to see your dashboard!`;

        try {
            await sendMessage(phone, `✅ *Registration Successful!*\n\nWelcome ${name}! 🏠 We are excited to have you stay with us.\n\n${detailedRules}`);
            await sendMedia(phone, regPath, '📄 Your registration copy', null, 'StayFlow_Registration.pdf');
        } catch (wsErr) {
            console.warn('WhatsApp notification failed, but registration succeeded:', wsErr.message);
        }

        if (config.ownerPhone) {
            try {
                await sendMessage(config.ownerPhone, `📝 *New Public Registration*\nName: ${name}\nPhone: ${phone}\nRoom: ${room || 'Pending'}`);
                await sendMedia(config.ownerPhone, regPath, `📝 Registration copy: ${name}`, null, 'StayFlow_Registration.pdf');
            } catch (e) { }
        }

        // 4. Create In-App Notification
        try {
            const title = `👤 New Resident: ${name}`;
            const body = `Registered for Room ${room || 'Pending'} — ${phone}`;

            await Notification.create({
                type: 'new_registration',
                title,
                body,
                meta: { tenantName: name, room, phone }
            });

            // 🚀 Send Remote Push Notification (Drop-down)
            await sendPushNotification(title, body, { type: 'new_registration', tenantName: name, room, phone });
        } catch (e) {
            console.error('Failed to create in-app notification:', e.message);
        }

        res.json({ success: true, message: 'Registration complete!' });
    } catch (err) {
        console.error('Public Registration Error:', err);
        res.status(500).json({ error: err.message });
    }
});


app.post('/webhook/google-form', async (req, res) => {
    try {
        const data = req.body;
        console.log('Google Form Submission Received:', data);

        const tenantData = {
            name: data.Name || data['Full Name'],
            phone: data.Phone || data['Phone Number'],
            room: data.Room || 'Unassigned',
            sharingType: data['Sharing Type'] || 'Unknown',
            advance: data.Advance || '0',
            aadhaarImage: data['Aadhaar Image Link'] || data['Aadhaar Image'] || data['Aadhaar'],
            monthlyRent: data['Monthly Rent'] || '0'
        };

        const detailedRules = `🏢 *PG House Rules & Regulations*\n━━━━━━━━━━━━━━━━━━━━\n⚖️ *DO's:*\n1. Keep your room and shared areas clean and hygienic.\n2. Maintain silence after 10:00 PM for everyone's comfort.\n3. Pay rent by the 5th and EB bills by the 10th of each month.\n4. Inform the admin 30 days before vacating.\n5. Cooperate with police verification and security checks.\n\n🚫 *DON'Ts:*\n1. Strictly NO smoking, alcohol, or illegal substances.\n2. No overnight visitors allowed without prior permission.\n3. Do not use heavy appliances (Heaters/AC/Iron) without approval.\n4. No loud music, parties, or disturbances in rooms.\n5. Do not damage PG property or furniture.\n\n📜 *Note:* Rules are for the safety and comfort of all residents.\n━━━━━━━━━━━━━━━━━━━━`;

        await sheetsService.init();
        const { fileName: regFile, filePath: regPath } = await pdfService.generateRegistrationForm(tenantData);
        tenantData.registrationForm = regFile;
        await sheetsService.addTenant(tenantData);

        await sendMessage(tenantData.phone, `🎉 Hello ${tenantData.name}! Your registration is successful. ✅\n\nWelcome to *${config.businessName}*! 🏠\n\n${detailedRules}\n\n🤖 *Smart Bot:* Type *HI* to see your dashboard and bills!`);
        await sendMedia(tenantData.phone, regPath, '📄 Your registration copy', null, 'StayFlow_Registration.pdf');

        if (config.ownerPhone) {
            await sendMessage(config.ownerPhone, `📝 *New Form Registration*\n\nName: ${tenantData.name}\nPhone: ${tenantData.phone}\nRoom: ${tenantData.room}\n\nPlease verify in the dashboard.`);
            await sendMedia(config.ownerPhone, regPath, `📝 Registration copy: ${tenantData.name}`, null, 'StayFlow_Registration.pdf');
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Form Webhook Error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/tenants', authenticate, async (req, res) => {
    try {
        console.log('--- Fetching Tenants for Dashboard ---');
        const tenants = await sheetsService.getTenantsJSON();
        console.log(`Response sent: ${tenants.length} tenants found.`);
        if (tenants.length === 0) {
            console.log('WARNING: Sheet returned 0 tenants. Check sheet title and headers.');
        }
        res.json(tenants);
    } catch (err) {
        console.error('API Tenants Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch tenants: ' + err.message });
    }
});

app.post('/api/add-tenant', authenticate, async (req, res) => {
    try {
        const tenantData = req.body;

        const detailedRules = `🏢 *PG House Rules & Regulations*\n━━━━━━━━━━━━━━━━━━━━\n⚖️ *DO's:*\n1. Keep your room and shared areas clean and hygienic.\n2. Maintain silence after 10:00 PM for everyone's comfort.\n3. Pay rent by the 5th and EB bills by the 10th of each month.\n4. Inform the admin 30 days before vacating.\n5. Cooperate with police verification and security checks.\n\n🚫 *DON'Ts:*\n1. Strictly NO smoking, alcohol, or illegal substances.\n2. No overnight visitors allowed without prior permission.\n\n🤖 *Tip:* Type *HI* to see your dashboard!`;

        const { fileName: regFile, filePath: regPath } = await pdfService.generateRegistrationForm({
            name: tenantData.name, phone: tenantData.phone, room: tenantData.room,
            sharingType: tenantData.sharingType, advance: tenantData.advance,
            monthlyRent: tenantData.rent || '0'
        });

        tenantData.registrationForm = regFile;
        await sheetsService.init();
        await sheetsService.addTenant(tenantData);

        await sendMessage(tenantData.phone, `✅ *Registration Successful!*\n\nWelcome ${tenantData.name}! 🏠\n\n${detailedRules}`);
        await sendMedia(tenantData.phone, regPath, '📄 Your registration copy', null, 'StayFlow_Registration.pdf');

        if (config.ownerPhone) {
            await sendMessage(config.ownerPhone, `📝 *Admin Added Resident*\nName: ${tenantData.name}\nPhone: ${tenantData.phone}`);
            await sendMedia(config.ownerPhone, regPath, `📝 Registration copy: ${tenantData.name}`, null, 'StayFlow_Registration.pdf');
        }

        // 🔔 Create In-App Notification
        try {
            const title = `👤 New Resident: ${tenantData.name}`;
            const body = `Admin added Room ${tenantData.room} • ${tenantData.phone}`;

            await Notification.create({
                type: 'new_registration',
                title,
                body,
                meta: { tenantName: tenantData.name, room: tenantData.room, phone: tenantData.phone }
            });

            // 🚀 Send Remote Push Notification (Drop-down)
            await sendPushNotification(title, body, { type: 'new_registration', tenantName: tenantData.name, room: tenantData.room, phone: tenantData.phone });
        } catch (e) {
            console.error('Failed to create in-app notification:', e.message);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Bulk Task Tracking ───────────────────────────────────────────
let lastBulkTask = {
    status: 'idle',
    total: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    failedList: [],
    startTime: null,
    endTime: null
};

app.get('/api/bulk-status', (req, res) => res.json(lastBulkTask));

app.post('/api/trigger-notifications', authenticate, async (req, res) => {
    try {
        // Re-read fresh data from Google Sheets 
        const tenants = await sheetsService.getAllTenants();
        const activeTenants = tenants.filter(t => t.get('Phone') && t.get('Status') !== 'VACATED');

        res.json({ success: true, message: `Notification process started for ${activeTenants.length} recipients.` });

        // 🔔 Create In-App Notification
        try {
            await Notification.create({
                type: 'broadcast',
                title: '🔔 Bulk Bill Reminders',
                body: `Sending rent & EB reminders to ${activeTenants.length} residents...`,
                meta: { count: activeTenants.length }
            });
        } catch (e) {
            console.error('Failed to create in-app notification:', e.message);
        }

        // Background async - send notifications without blocking response
        (async () => {
            let sentCount = 0;
            let failCount = 0;
            let skippedCount = 0;
            let failedRecipients = [];

            lastBulkTask = {
                status: 'running',
                total: activeTenants.length,
                sent: 0,
                failed: 0,
                skipped: 0,
                failedList: [],
                startTime: new Date().toISOString(),
                endTime: null
            };

            for (const tenant of activeTenants) {
                const phone = tenant.get('Phone');
                const name = tenant.get('Name');

                try {
                    // Read FRESH values from sheet
                    const freshTenant = await sheetsService.getTenantByPhone(phone, name);
                    if (!freshTenant) continue;

                    const currentStatus = freshTenant.get('Status');
                    // 🚨 SKIP IF ALREADY PAID
                    if (currentStatus === 'PAID' || currentStatus === 'VALID') {
                        skippedCount++;
                        continue;
                    }

                    const rent = (freshTenant.get('Monthly Rent') || '0').toString().replace(/[^\d.]/g, '');
                    const eb = (freshTenant.get('EB Amount') || '0').toString().replace(/[^\d.]/g, '');
                    const total = parseFloat(rent) + parseFloat(eb);

                    if (total <= 0) {
                        skippedCount++;
                        continue;
                    }

                    // Update Status to PENDING
                    await sheetsService.updateTenant(phone, { 'Status': 'PENDING' }, name);

                    // Generate payment link to website
                    const razorpayLink = await createRazorpayLink(phone, name, total, freshTenant.get('Room'));

                    // Generate invoice PDF
                    const tenantData = {
                        Name: name, Phone: phone, Room: freshTenant.get('Room'),
                        EB_Amount: eb, Monthly_Rent: rent, Total_Amount: total,
                        Paid_Date: 'PENDING', Transaction_ID: 'PENDING', Payment_Mode: 'PENDING'
                    };
                    const { fileName, filePath } = await pdfService.generateInvoice(tenantData);

                    // Build notification message
                    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
                    let caption = `🛡️ *StayFlow Rental Payment — ${currentMonth}*\n\nHi ${name},\n\nYour monthly bill has been generated and is ready for payment. Please find your invoice attached below.\n\n📋 *Payment Summary:*\n🏠 Current Rent: ₹${rent}\n⚡ EB Charges: ₹${eb}\n💰 *TOTAL DUE: ₹${total}*\n\n📅 *Due Date:* 5th ${currentMonth}\n\nKindly clear your dues via the link below or by cash at the office.`;

                    if (razorpayLink) caption += `\n\n💳 *Pay Fast & Securely:* \n${razorpayLink}`;
                    caption += `\n\n_If you have already paid, please share the transaction receipt._`;

                    // Send via WhatsApp
                    await sendMedia(phone, filePath, caption, ["💳 Pay Now", "💵 Pay Cash", "❌ Cancel"]);

                    // 🔔 Create In-App Notification
                    try {
                        const title = `Invoice Sent: ${name}`;
                        const body = `₹${total} invoice sent to Room ${freshTenant.get('Room')}`;

                        await Notification.create({
                            type: 'invoice_sent',
                            title,
                            body,
                            meta: { tenantName: name, room: freshTenant.get('Room'), amount: total }
                        });

                        // 🚀 Send Remote Push Notification (Drop-down)
                        await sendPushNotification(title, body, { type: 'invoice_sent', tenantName: name, room: freshTenant.get('Room'), amount: total });
                    } catch (e) {
                        console.error('Failed to create in-app notification:', e.message);
                    }

                    sentCount++;
                    console.log(`[NOTIFY] Sent to ${name} (${sentCount}/${activeTenants.length})`);
                    await new Promise(r => setTimeout(r, 1200));
                } catch (e) {
                    failCount++;
                    failedRecipients.push(name || phone);
                    console.error(`Failed to notify ${name}:`, e.message);
                }

                // Update real-time status
                lastBulkTask.sent = sentCount;
                lastBulkTask.failed = failCount;
                lastBulkTask.skipped = skippedCount;
                lastBulkTask.failedList = failedRecipients;
            }

            console.log(`[NOTIFY] Complete: ${sentCount} sent, ${failCount} failed, ${skippedCount} skipped.`);
            lastBulkTask.status = 'completed';
            lastBulkTask.endTime = new Date().toISOString();

            // 🔔 Create In-App Notification (Summary Report)
            try {
                const title = `📢 Bulk Invoices Report`;
                const failureDetails = failCount > 0 ? `\n❌ Failed: ${failCount}` : '';
                const body = `✅ Sent: ${sentCount}\n⏭️ Skipped: ${skippedCount}${failureDetails}`;

                await Notification.create({
                    type: 'bulk_notify_report',
                    title,
                    body,
                    meta: {
                        sent: sentCount,
                        failed: failCount,
                        skipped: skippedCount,
                        failures: failedRecipients,
                        timestamp: new Date().toISOString()
                    }
                });

                // 🚀 Send Remote Push Notification (Drop-down)
                await sendPushNotification(title, body, { type: 'bulk_notify_report', sentCount });
            } catch (e) {
                console.error('Failed to create report notification:', e.message);
            }
        })();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/generate-invoice', async (req, res) => {
    try {
        const { phone, name } = req.body;
        const tenant = await sheetsService.getTenantByPhone(phone, name);
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        const rent = (tenant.get('Monthly Rent') || '0').toString().replace(/[^\d.]/g, '');
        const eb = (tenant.get('EB Amount') || '0').toString().replace(/[^\d.]/g, '');
        const total = parseFloat(rent) + parseFloat(eb);

        const tenantData = {
            Name: tenant.get('Name'), Phone: tenant.get('Phone'), Room: tenant.get('Room'),
            EB_Amount: eb, Monthly_Rent: rent, Total_Amount: total,
            Paid_Date: tenant.get('Status') === 'PAID' ? (tenant.get('Paid Date') || 'N/A') : 'PENDING',
            Transaction_ID: tenant.get('Transaction ID') || 'PENDING',
            Payment_Mode: tenant.get('Payment Mode') || 'PENDING'
        };
        const { fileName } = await pdfService.generateInvoice(tenantData);
        res.json({ success: true, url: `/api/uploads/${fileName}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/notify-tenant', authenticate, async (req, res) => {
    try {
        const { phone, name: requestedName } = req.body;
        const tenant = await sheetsService.getTenantByPhone(phone, requestedName);
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        const name = tenant.get('Name');
        await setTenantContext(phone, name);
        const rent = (tenant.get('Monthly Rent') || '0').toString().replace(/[^\d.]/g, '');
        const eb = (tenant.get('EB Amount') || '0').toString().replace(/[^\d.]/g, '');
        const total = parseFloat(rent) + parseFloat(eb);

        const tenantData = {
            Name: name, Phone: tenant.get('Phone'), Room: tenant.get('Room'),
            EB_Amount: eb, Monthly_Rent: rent, Total_Amount: total,
            Paid_Date: 'PENDING', Transaction_ID: 'PENDING', Payment_Mode: 'PENDING'
        };
        const { filePath } = await pdfService.generateInvoice(tenantData);

        const currentMonth = new Date().toLocaleString('default', { month: 'long' });
        const razorpayLink = await createRazorpayLink(phone, name, total, tenant.get('Room'));

        let caption = `🧾 *Invoice & Payment*\n\nHi ${name},\n💰 *Total Due: ₹${total}*\n📅 *Due Date:* 5th ${currentMonth}`;
        if (razorpayLink) caption += `\n\n💳 *Pay Online (Razorpay):*\n${razorpayLink}`;

        if (filePath) await sendMedia(phone, filePath, caption, ["💳 Pay Now UPI", "💵 Pay Cash", "❌ Cancel"]);
        else await sendMessage(phone, caption);

        // 🔔 Create In-App Notification
        try {
            const title = `📄 Invoice Sent: ${name}`;
            const body = `₹${total} invoice sent to Room ${tenant.get('Room')}`;

            await Notification.create({
                type: 'invoice_sent',
                title,
                body,
                meta: { tenantName: name, room: tenant.get('Room'), amount: total }
            });

            // 🚀 Send Remote Push Notification (Drop-down)
            await sendPushNotification(title, body, { type: 'invoice_sent', tenantName: name, room: tenant.get('Room'), amount: total });
        } catch (e) {
            console.error('Failed to create in-app notification:', e.message);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/update-bill', authenticate, async (req, res) => {
    try {
        const { phone, name, rent, eb } = req.body;
        const total = parseFloat(rent) + parseFloat(eb);
        // 1. Update Google Sheets (Auto-syncs to MongoDB)
        const success = await sheetsService.updateTenant(phone, {
            'Monthly Rent': rent.toString(), 'EB Amount': eb.toString(), 'Total Amount': total.toString()
        }, name);
        if (!success) return res.status(404).json({ error: 'Tenant not found' });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/update-and-notify', authenticate, async (req, res) => {
    try {
        const { oldPhone, newPhone, name, rent, eb, sharingType, location, oldName, status, room } = req.body;
        const phoneToUse = oldPhone || req.body.phone;
        const safeRent = (rent || '0').toString();
        const safeEb = (eb || '0').toString();
        const total = parseFloat(safeRent.replace(/[^\d.]/g, '')) + parseFloat(safeEb.replace(/[^\d.]/g, ''));

        const updateData = {
            'Name': name || oldName, 'Phone': newPhone || phoneToUse, 'Monthly Rent': safeRent,
            'EB Amount': safeEb, 'Total Amount': total.toString(),
            'Sharing Type': sharingType || 'Unknown', 'Location': location || 'Main Branch'
        };

        // Include Room if provided
        if (room) updateData['Room'] = room.toString();

        // Include Status if provided (PAID, PENDING, VALID, etc.)
        if (status) updateData['Status'] = status;

        // 1. Update Google Sheets (Auto-syncs to MongoDB)
        const success = await sheetsService.updateTenant(phoneToUse, updateData, oldName || name);
        if (!success) {
            return res.status(404).json({ error: 'Resident not found.' });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/mark-paid', authenticate, async (req, res) => {
    try {
        const { phone, name, amount, mode } = req.body;
        // 1. Update Google Sheets (Auto-syncs to MongoDB)
        const success = await sheetsService.updateTenant(phone, {
            'Status': 'VALID', 'Paid Date': new Date().toLocaleDateString(),
            'Transaction ID': `${mode.toUpperCase()}-${Date.now().toString().slice(-4)}`,
            'Payment Mode': mode
        }, name);
        if (!success) return res.status(404).json({ error: 'Tenant not found' });

        const tenant = await sheetsService.getTenantByPhone(phone, name);
        await sheetsService.logPayment(tenant, amount, mode, 'MANUAL-ENTRY', 'VALID');

        // Clear cache for this phone
        clearPaymentInfoCache(phone);

        const tenantData = {
            Name: tenant.get('Name'), Phone: tenant.get('Phone'), Room: tenant.get('Room'),
            EB_Amount: tenant.get('EB Amount') || '0', Monthly_Rent: tenant.get('Monthly Rent') || '0',
            Total_Amount: amount, Paid_Date: new Date().toLocaleDateString(),
            Transaction_ID: mode.toUpperCase(), Payment_Mode: mode
        };
        const { filePath } = await pdfService.generateInvoice(tenantData);

        const eb = tenant.get('EB Amount') || '0';
        const rent = tenant.get('Monthly Rent') || '0';
        const receiptMsg = `✅ *Payment Confirmed!*\n\nHi ${name},\n\n📋 *Breakdown:*\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n💰 *Total Paid: ₹${amount}*\n\n📅 Date: ${new Date().toLocaleDateString()}\n💳 Mode: ${mode.toUpperCase()}\n\nThank you for your payment! 🙏`;
        await sendMessage(phone, receiptMsg);
        await sendMedia(phone, filePath, "📄 Here is your payment receipt");

        if (config.ownerPhone) {
            await sendMessage(config.ownerPhone, `💰 *Money In*\nTenant: ${name}\nRoom: ${tenant.get('Room')}\nRent: ₹${rent} | EB: ₹${eb}\nTotal: ₹${amount}\nMode: ${mode}`);
        }

        // 🔔 Create In-App Notification
        try {
            const title = `Payment Recorded: ${name}`;
            const body = `₹${amount} recorded via ${mode} — Room ${tenant.get('Room')}`;

            await Notification.create({
                type: 'payment_received',
                title,
                body,
                meta: { tenantName: name, room: tenant.get('Room'), amount, mode }
            });

            // 🚀 Send Remote Push Notification (Drop-down)
            await sendPushNotification(title, body, { type: 'payment_received', tenantName: name, room: tenant.get('Room'), amount, mode });
        } catch (e) {
            console.error('Failed to create in-app notification:', e.message);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/delete-tenant', authenticate, async (req, res) => {
    try {
        const { phone, name } = req.body;

        // Archive to MongoDB before deleting
        const tenant = await sheetsService.getTenantByPhone(phone, name);
        if (tenant) {
            await Tenant.create({
                name: tenant.get('Name'),
                phone: tenant.get('Phone'),
                room: tenant.get('Room'),
                bed: tenant.get('Bed'),
                floor: tenant.get('Floor'),
                location: tenant.get('Location'),
                sharingType: tenant.get('Sharing Type'),
                advance: tenant.get('Advance'),
                monthlyRent: tenant.get('Monthly Rent'),
                ebAmount: tenant.get('EB Amount'),
                totalAmount: tenant.get('Total Amount'),
                status: 'DELETED_FROM_SHEET',
                joinDate: tenant.get('Join Date'),
                paidDate: tenant.get('Paid Date'),
                aadhaarImage: tenant.get('Aadhaar Image')
            });
        }

        const success = await sheetsService.deleteTenant(phone, name);
        if (success) res.json({ success: true });
        else res.status(404).json({ error: 'Tenant not found' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sync-to-mongo', authenticate, async (req, res) => {
    try {
        const count = await sheetsService.syncAllToMongo();
        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/archived-tenants', authenticate, async (req, res) => {
    try {
        const tenants = await Tenant.find().sort({ archivedAt: -1 });
        res.json(tenants);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post(['/api/announcement', '/api/broadcast'], authenticate, upload.single('file'), async (req, res) => {
    try {
        const { message, phone, name } = req.body;
        const file = req.file;
        if (!message && !file) return res.status(400).json({ error: 'Message or file required' });

        let targets = [];
        if (phone) {
            targets = [{ Phone: phone, Name: name || 'Resident' }];
        } else {
            const tenants = await sheetsService.getTenantsJSON();
            targets = tenants.filter(t => t.Status !== 'VACATED');
        }

        if (targets.length === 0) return res.status(404).json({ error: 'No recipients found' });

        // Create In-App Notification (only for broadcast)
        if (!phone) {
            try {
                await Notification.create({
                    type: 'announcement',
                    title: '📢 New Announcement',
                    body: message || (file ? 'Sent an attachment' : 'Announcement sent to residents'),
                    meta: {
                        message,
                        hasFile: !!file,
                        count: targets.length,
                        imageUrl: file ? `${req.protocol}://${req.get('host')}/api/uploads/${file.filename}` : null
                    }
                });
            } catch (e) {
                console.error('Failed to create announcement notification:', e.message);
            }
        }

        // Respond immediately to prevent mobile app timeout
        res.json({
            success: true,
            message: phone ? `Sending message to ${name || phone}...` : `Sending announcement to ${targets.length} residents...`,
            imageUrl: file ? `${req.protocol}://${req.get('host')}/api/uploads/${file.filename}` : null
        });

        // Background process
        (async () => {
            console.log(`[MESSAGE] Starting background send to ${targets.length} recipients...`);
            let sentCount = 0;
            for (const t of targets) {
                if (!t.Phone) continue;
                try {
                    if (file) {
                        await sendMedia(t.Phone, file.path, message || '', null, file.originalname);
                    } else {
                        await sendMessage(t.Phone, phone ? message : `📢 *Announcement*\n\n${message}`);
                    }
                    sentCount++;
                    await new Promise(r => setTimeout(r, 1000));
                } catch (err) {
                    console.error(`[MESSAGE] Error for ${t.Phone}:`, err.message);
                }
            }
            console.log(`[MESSAGE] Complete: Sent to ${sentCount}/${targets.length} recipients.`);
        })();
    } catch (err) {
        console.error('Announcement API Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/notifications', authenticate, async (req, res) => {
    try {
        const notifications = await Notification.find().sort({ timestamp: -1 }).limit(100);
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/notifications/unread-count', authenticate, async (req, res) => {
    try {
        const count = await Notification.countDocuments({ read: false });
        res.json({ count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/notifications/mark-read', authenticate, async (req, res) => {
    try {
        const { id } = req.body;
        if (id) {
            await Notification.findByIdAndUpdate(id, { read: true });
        } else {
            await Notification.updateMany({ read: false }, { read: true });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/notifications', authenticate, async (req, res) => {
    try {
        await Notification.deleteMany({});
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/locations', authenticate, async (req, res) => {
    try { res.json(await sheetsService.getAllLocations()); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/locations', authenticate, async (req, res) => {
    try {
        const { name, address, totalRooms, floors, totalBeds, notes } = req.body;
        await sheetsService.addLocation({ name, address, totalRooms, floors, totalBeds, notes });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/eb-bills', authenticate, async (req, res) => {
    try {
        const { location } = req.query;
        res.json(await sheetsService.getEBBillsByLocation(location || 'Main Branch'));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/eb-bills', authenticate, async (req, res) => {
    try {
        const { monthYear, location, totalUnits, ratePerUnit, notes } = req.body;
        const result = await sheetsService.addEBBill({ monthYear, location, totalUnits, ratePerUnit, notes });
        const tenants = await sheetsService.getTenantsByLocation(location || 'Main Branch');
        const active = tenants.filter(t => t.get('Status') !== 'VACATED');
        if (active.length > 0) {
            const perPersonEB = Math.round(result.totalEB / active.length);
            for (const t of active) {
                const rent = parseFloat(t.get('Monthly Rent') || 0);
                // Update Google Sheets (Auto-syncs to MongoDB)
                await sheetsService.updateTenant(t.get('Phone'), {
                    'EB Amount': perPersonEB.toString(), 'Total Amount': (rent + perPersonEB).toString()
                }, t.get('Name'));
            }
        }
        res.json({ success: true, totalEB: result.totalEB });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/dashboard-stats', authenticate, async (req, res) => {
    try { res.json(await sheetsService.getDashboardStats()); }
    catch (err) {
        console.error('Dashboard Stats Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch stats: ' + err.message });
    }
});

// ==================== PUSH NOTIFICATIONS ====================

/**
 * Register a mobile device's Expo Push Token
 */
app.post('/api/register-push-token', authenticate, async (req, res) => {
    try {
        const { token, platform } = req.body;
        if (!token) return res.status(400).json({ error: 'Token is required' });

        await PushToken.findOneAndUpdate(
            { token },
            { token, platform, lastUsed: new Date() },
            { upsert: true, new: true }
        );

        res.json({ success: true, message: 'Push token registered' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/config', authenticate, (req, res) => {
    res.json({
        businessName: config.businessName,
        upiId: config.upiId,
        ownerPhone: config.ownerPhone,
        rentDueDate: config.rentDueDate,
        ebDueDate: config.ebDueDate,
        ebUnitRate: config.ebUnitRate,
        googleFormUrl: config.googleFormUrl
    });
});

// Diagnostic endpoint for Razorpay configuration (Admin only)
app.get('/api/razorpay-status', authenticate, (req, res) => {
    const keyIdSet = !!config.razorpay.key_id;
    const keySecretSet = !!config.razorpay.key_secret;
    const instanceInitialized = !!razorpayInstance;
    
    res.json({
        configured: keyIdSet && keySecretSet,
        keyId: keyIdSet ? config.razorpay.key_id.substring(0, 15) + '...' : 'NOT SET',
        keySecretLength: keySecretSet ? config.razorpay.key_secret.length : 0,
        instanceInitialized: instanceInitialized,
        status: instanceInitialized ? 'READY' : 'NOT INITIALIZED',
        message: instanceInitialized 
            ? 'Razorpay is properly configured and ready to accept payments' 
            : 'Razorpay credentials missing or invalid. Update RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.'
    });
});

app.get('/api/health', async (req, res) => {
    try {
        // 1. Check MongoDB
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

        // 2. Check Sheets
        let sheetsStatus = 'disconnected';
        try {
            await sheetsService.init();
            await sheetsService.sheet.getRows({ limit: 1 });
            sheetsStatus = 'connected';
        } catch (e) {
            console.error('Health Check: Sheets Failed', e.message);
        }

        const isHealthy = dbStatus === 'connected' && sheetsStatus === 'connected';

        res.status(isHealthy ? 200 : 503).json({
            status: isHealthy ? 'ok' : 'unhealthy',
            version: '1.1.0',
            time: new Date().toISOString(),
            mongodb: dbStatus,
            sheets: sheetsStatus,
            wwebReady: wweb.ready
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/', (req, res) => {
    if (fs.existsSync(dashboardDist)) {
        res.sendFile(path.join(dashboardDist, 'index.html'));
    } else {
        res.send(`
            <html>
            <head>
                <title>StayFlow - Running</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
                    .container { background: white; color: #333; padding: 40px; border-radius: 20px; max-width: 600px; margin: 0 auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
                    h1 { margin-bottom: 20px; }
                    a { display: inline-block; margin: 10px; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 25px; transition: all 0.3s; }
                    a:hover { background: #764ba2; transform: translateY(-2px); }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🚀 StayFlow Cloud Bot</h1>
                    <p>Service is running!</p>
                    <div style="margin-top: 30px;">
                        <a href="/wake.html">⚡ Wake Service</a>
                        <a href="/api/wake">📡 Wake API</a>
                        <a href="/health">💚 Health Check</a>
                    </div>
                    <p style="margin-top: 30px; color: #666;">
                        Full Dashboard: <a href="https://stay-flow-kohl.vercel.app" target="_blank">Open Dashboard</a>
                    </p>
                </div>
            </body>
            </html>
        `);
    }
});

// Health check endpoint for keep-alive
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Wake-up endpoint - Click to wake Render service
app.get('/api/wake', (req, res) => {
    console.log(`[WAKE-UP] Service woken at ${new Date().toISOString()}`);
    res.status(200).json({ 
        message: '✅ StayFlow is awake!',
        status: 'active',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        renderUrl: process.env.RENDER_API_URL || 'https://stayflow-tkto.onrender.com'
    });
});

// 4. Final Error Handling Middleware (JSON for API)
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err);
    if (res.headersSent) {
        return next(err);
    }
    // Handle Multer errors specifically
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large! Max limit is 2MB.' });
    }
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error'
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    // Start keep-alive service to prevent Render sleep
    keepAliveService.start();
});

setupCron();
