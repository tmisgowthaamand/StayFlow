import express from 'express';
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
import wweb from './wweb.js';
import pdfService from './pdfService.js';
import { Log, Media, Tenant } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NOTE: MongoDB sync is now handled automatically inside sheets.js
// Every call to sheetsService.updateTenant(), addTenant(), verifyPayment(), rejectPayment()
// auto-syncs to MongoDB. No need for separate sync calls.

const app = express();
app.use(cors({
    origin: (config.allowedOrigins.length > 0 && config.allowedOrigins[0] !== '') ? config.allowedOrigins : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(bodyParser.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

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
// 2. Serve uploads
app.use('/api/uploads', express.static(uploadsDir));
// 3. Serve public folder (registration, rules, etc)
app.use(express.static(path.join(__dirname, '../public')));

const port = process.env.PORT || 3000;

// Initialize Razorpay instance for order creation
let razorpayInstance = null;
if (config.razorpay.key_id && config.razorpay.key_secret) {
    razorpayInstance = new Razorpay({
        key_id: config.razorpay.key_id,
        key_secret: config.razorpay.key_secret,
    });
    console.log('✅ Razorpay initialized for payment orders');
}

// ==================== PAYMENT PAGE APIs ====================

// GET /api/payment-info — Fetch tenant bill details for the payment page
app.get('/api/payment-info', async (req, res) => {
    try {
        const { phone, name } = req.query;
        if (!phone) return res.status(400).json({ error: 'Phone number is required' });

        const tenant = await sheetsService.getTenantByPhone(phone, name);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found. Please check your phone number or contact admin.' });
        }

        const tName = tenant.get('Name') || '';
        const tRoom = tenant.get('Room') || 'N/A';
        const tRent = parseFloat((tenant.get('Monthly Rent') || '0').toString().replace(/[^\d.]/g, ''));
        const tEB = parseFloat((tenant.get('EB Amount') || '0').toString().replace(/[^\d.]/g, ''));
        const tTotal = tRent + tEB;
        const tStatus = tenant.get('Status') || 'PENDING';

        res.json({
            name: tName,
            room: tRoom,
            rent: tRent,
            eb: tEB,
            total: tTotal,
            status: tStatus,
            transactionId: tenant.get('Transaction ID') || '',
            paidDate: tenant.get('Paid Date') || '',
            razorpayKeyId: config.razorpay.key_id || ''
        });
    } catch (err) {
        console.error('Payment Info Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/create-order — Create a Razorpay Order for embedded checkout
app.post('/api/create-order', async (req, res) => {
    try {
        const { phone, name, amount, room } = req.body;

        if (!razorpayInstance) {
            return res.status(503).json({ error: 'Payment gateway not configured. Please contact admin.' });
        }

        if (!phone || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid payment details' });
        }

        const amountInPaise = Math.round(parseFloat(amount) * 100);

        const order = await razorpayInstance.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `SF-${phone.slice(-4)}-${Date.now().toString().slice(-6)}`,
            notes: {
                phone: phone,
                tenant_name: name || 'Tenant',
                room: room || 'N/A'
            }
        });

        console.log(`[RAZORPAY ORDER] Created: ${order.id} for ${phone} | ₹${amount}`);

        res.json({
            orderId: order.id,
            amount: amountInPaise,
            currency: 'INR',
            razorpayKeyId: config.razorpay.key_id
        });
    } catch (err) {
        console.error('Create Order Error:', err.message);
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

        // Verify webhook signature if secret is set
        const webhookSecret = config.razorpay?.key_secret;
        if (webhookSecret && req.headers['x-razorpay-signature']) {
            const expectedSignature = crypto
                .createHmac('sha256', webhookSecret)
                .update(JSON.stringify(req.body))
                .digest('hex');
            if (expectedSignature !== req.headers['x-razorpay-signature']) {
                console.error('Razorpay webhook signature mismatch!');
                return res.status(400).json({ error: 'Invalid signature' });
            }
        }

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

            // If already PAID, and either ID matches or we found them by phone, consider it success
            if (sheetStatus === 'PAID') {
                console.log(`[VERIFY] Tenant already marked PAID. Proceeding.`);
                const tName = tenant.get('Name') || '';
                const tRoom = tenant.get('Room') || 'N/A';
                const tRent = tenant.get('Monthly Rent') || '0';
                const tEB = tenant.get('EB Amount') || '0';
                const tTotal = parseFloat(tRent) + parseFloat(tEB);
                const tTrxId = tenant.get('Transaction ID') || trxId;
                const tPaidDate = tenant.get('Paid Date') || new Date().toLocaleDateString();
                // Generate invoice URL for download
                let invoiceUrl = '';
                try {
                    const invData = {
                        Name: tName, Phone: phone, Room: tRoom,
                        EB_Amount: tEB, Monthly_Rent: tRent, Total_Amount: tTotal.toString(),
                        Paid_Date: tPaidDate, Transaction_ID: tTrxId, Payment_Mode: 'UPI (Razorpay)'
                    };
                    const { fileName } = await pdfService.generateInvoice(invData);
                    invoiceUrl = `/api/uploads/${fileName}`;
                } catch (pdfErr) { console.error('Invoice gen error:', pdfErr.message); }
                return res.json({
                    success: true,
                    message: 'Payment Verified',
                    botNumber: config.ownerPhone || '917010905730',
                    tenantPhone: phone,
                    tenantName: tName,
                    room: tRoom,
                    rent: tRent,
                    eb: tEB,
                    total: tTotal,
                    trxId: tTrxId,
                    paidDate: tPaidDate,
                    invoiceUrl: invoiceUrl
                });
            }
        }

        // 2. Check Razorpay Webhook Data in MongoDB logs (More flexible match)
        // Search by TRX ID, Payment ID, or any relevant Razorpay field
        const webhookLog = await Log.findOne({
            action: 'RAZORPAY_WEBHOOK',
            $or: [
                { 'details.payload.payment.entity.id': { $regex: trxId, $options: 'i' } },
                { 'details.payload.payment_link.entity.id': { $regex: trxId, $options: 'i' } },
                { 'details.payload.payment.entity.acquirer_data.rrn': trxId },
                { 'details.payload.payment.entity.acquirer_data.upi_transaction_id': trxId },
                { 'details.payload.payment.entity.notes.phone': phone }
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
                    success: true, botNumber: config.ownerPhone || '917010905730',
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
                        await handleRazorpaySuccess(targetPhone, rzpAmount, trxId, 'UPI (Razorpay)');
                        const uTenant = await sheetsService.getTenantByPhone(targetPhone);
                        let invoiceUrl = '';
                        if (uTenant) {
                            try {
                                const { fileName } = await pdfService.generateInvoice({
                                    Name: uTenant.get('Name'), Phone: targetPhone, Room: uTenant.get('Room') || 'N/A',
                                    EB_Amount: uTenant.get('EB Amount') || '0', Monthly_Rent: uTenant.get('Monthly Rent') || '0',
                                    Total_Amount: rzpAmount.toString(), Paid_Date: new Date().toLocaleDateString(),
                                    Transaction_ID: trxId, Payment_Mode: 'UPI (Razorpay)'
                                });
                                invoiceUrl = `/api/uploads/${fileName}`;
                            } catch (e) { }
                        }
                        return res.json({
                            success: true, botNumber: config.ownerPhone || '917010905730',
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
                            success: true, botNumber: config.ownerPhone || '917010905730',
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
                botNumber: config.ownerPhone || '917010905730',
                tenantPhone: phone, tenantName: fbName, room: fbRoom,
                rent: fbRent, eb: fbEB, total: fbTotal, trxId,
                paidDate: tenant.get('Paid Date') || new Date().toLocaleDateString()
            });
        }

        console.warn(`Transaction NOT found after all checks: ${trxId}`);
        res.status(404).json({
            success: false,
            error: 'Transaction ID not found. Please contact support.',
            botNumber: config.ownerPhone || '917010905730'
        });
    } catch (err) {
        console.error('Verify Transaction Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Initialize WWeb for Free Automation
wweb.init();

// Proxy for WhatsApp Media
app.get('/api/media/:id', async (req, res) => {
    try {
        const mediaId = req.params.id;
        const safeMediaId = path.basename(mediaId);
        const localPath = path.join(uploadsDir, safeMediaId);

        console.log(`Media Request: ${safeMediaId}`);

        if (fs.existsSync(localPath) && fs.lstatSync(localPath).isFile()) {
            console.log(`Serving local media: ${safeMediaId}`);
            const ext = path.extname(safeMediaId).toLowerCase();
            if (!ext) {
                if (/^[a-f0-9]{32}$/i.test(safeMediaId) || safeMediaId.startsWith('wweb_')) {
                    res.setHeader('Content-Type', 'image/jpeg');
                }
            }
            return res.sendFile(localPath);
        }

        console.log(`Fetching remote media from WhatsApp: ${mediaId}`);
        const urlRes = await axios.get(`https://graph.facebook.com/v17.0/${mediaId}`, {
            headers: { Authorization: `Bearer ${config.whatsapp.token}` }
        });

        const mediaUrl = urlRes.data.url;
        const mediaRes = await axios.get(mediaUrl, {
            headers: { Authorization: `Bearer ${config.whatsapp.token}` },
            responseType: 'stream'
        });

        res.setHeader('Content-Type', mediaRes.headers['content-type']);
        mediaRes.data.pipe(res);
    } catch (err) {
        console.error(`Media proxy error for ${req.params.id}:`, err.message);
        if (err.response && err.response.status === 404) {
            res.status(404).send('Media not found on local server or WhatsApp');
        } else {
            res.status(500).send('Error loading media: ' + err.message);
        }
    }
});

app.post('/api/update-eb', async (req, res) => {
    try {
        const { room, totalEB } = req.body;
        await handleUpdateEB(config.ownerPhone, room, totalEB);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/bulk-update-eb — Bulk update EB amounts for multiple tenants (Monthly Billing tab)
app.post('/api/bulk-update-eb', async (req, res) => {
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

const upload = multer({ dest: 'uploads/' });

app.post('/api/upload-aadhaar', upload.single('aadhaar'), async (req, res) => {
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

app.get('/api/tenants', async (req, res) => {
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
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/add-tenant', async (req, res) => {
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

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/trigger-notifications', async (req, res) => {
    try {
        // Re-read fresh data from Google Sheets 
        const tenants = await sheetsService.getAllTenants();
        const activeTenants = tenants.filter(t => t.get('Phone') && t.get('Status') !== 'VACATED');

        res.json({ success: true, message: `Notification process started for ${activeTenants.length} recipients.` });

        // Background async - send notifications without blocking response
        (async () => {
            let sentCount = 0;
            for (const tenant of activeTenants) {
                const phone = tenant.get('Phone');
                const name = tenant.get('Name');

                try {
                    // Read FRESH values from sheet (in case bulk-update-eb just ran)
                    const freshTenant = await sheetsService.getTenantByPhone(phone, name);
                    if (!freshTenant) continue;

                    const rent = (freshTenant.get('Monthly Rent') || '0').toString().replace(/[^\d.]/g, '');
                    const eb = (freshTenant.get('EB Amount') || '0').toString().replace(/[^\d.]/g, '');
                    const total = parseFloat(rent) + parseFloat(eb);

                    // Update Status to PENDING if not already PAID
                    const currentStatus = freshTenant.get('Status');
                    if (currentStatus !== 'PAID' && currentStatus !== 'VALID') {
                        await sheetsService.updateTenant(phone, { 'Status': 'PENDING' }, name);
                    }

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
                    let caption = `🔔 *Monthly Bill — ${currentMonth}*\n\nHi ${name},\n\n📋 *Breakdown:*\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n💰 *Total Due: ₹${total}*\n\n📅 *Due Date: 5th ${currentMonth}*`;
                    if (razorpayLink) caption += `\n\n💳 *Pay Online:* ${razorpayLink}`;

                    // Send via WhatsApp
                    await sendMedia(phone, filePath, caption, ["💳 Pay Now UPI", "💵 Pay Cash", "❌ Cancel"]);

                    sentCount++;
                    console.log(`[NOTIFY] Sent to ${name} (${sentCount}/${activeTenants.length})`);
                    await new Promise(r => setTimeout(r, 1000));
                } catch (e) { console.error(`Failed to notify ${name}:`, e.message); }
            }
            console.log(`[NOTIFY] Complete: ${sentCount}/${activeTenants.length} notifications sent.`);
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

app.post('/api/notify-tenant', async (req, res) => {
    try {
        const { phone, name: requestedName } = req.body;
        const tenant = await sheetsService.getTenantByPhone(phone, requestedName);
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        const name = tenant.get('Name');
        setTenantContext(phone, name);
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

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/update-bill', async (req, res) => {
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

app.post('/api/update-and-notify', async (req, res) => {
    try {
        const { oldPhone, newPhone, name, rent, eb, sharingType, location, oldName } = req.body;
        const phoneToUse = oldPhone || req.body.phone;
        const safeRent = (rent || '0').toString();
        const safeEb = (eb || '0').toString();
        const total = parseFloat(safeRent.replace(/[^\d.]/g, '')) + parseFloat(safeEb.replace(/[^\d.]/g, ''));

        const updateData = {
            'Name': name || oldName, 'Phone': newPhone || phoneToUse, 'Monthly Rent': safeRent,
            'EB Amount': safeEb, 'Total Amount': total.toString(),
            'Sharing Type': sharingType || 'Unknown', 'Location': location || 'Main Branch'
        };

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

app.post('/api/mark-paid', async (req, res) => {
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
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/delete-tenant', async (req, res) => {
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

app.post('/api/sync-to-mongo', async (req, res) => {
    try {
        const count = await sheetsService.syncAllToMongo();
        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/archived-tenants', async (req, res) => {
    try {
        const tenants = await Tenant.find().sort({ archivedAt: -1 });
        res.json(tenants);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/broadcast', upload.single('file'), async (req, res) => {
    try {
        const { message } = req.body;
        const file = req.file;
        if (!message && !file) return res.status(400).json({ error: 'Message or file required' });

        const tenants = await sheetsService.getTenantsJSON();
        const active = tenants.filter(t => t.Status !== 'VACATED');

        for (const t of active) {
            if (!t.Phone) continue;
            try {
                if (file) {
                    await sendMedia(t.Phone, file.path, message || '', null, file.originalname);
                } else {
                    await sendMessage(t.Phone, `📢 *Announcement*\n\n${message}`);
                }
            } catch (err) {
                console.error(`Broadcast error for ${t.Phone}:`, err.message);
            }
        }
        res.json({ success: true, count: active.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/locations', async (req, res) => {
    try { res.json(await sheetsService.getAllLocations()); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/locations', async (req, res) => {
    try {
        const { name, address, totalRooms, floors, totalBeds, notes } = req.body;
        await sheetsService.addLocation({ name, address, totalRooms, floors, totalBeds, notes });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/eb-bills', async (req, res) => {
    try {
        const { location } = req.query;
        res.json(await sheetsService.getEBBillsByLocation(location || 'Main Branch'));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/eb-bills', async (req, res) => {
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

app.get('/api/dashboard-stats', async (req, res) => {
    try { res.json(await sheetsService.getDashboardStats()); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/config', (req, res) => {
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

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '1.0.1',
        time: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        wwebReady: wweb.ready
    });
});

app.get('/', (req, res) => {
    if (fs.existsSync(dashboardDist)) {
        res.sendFile(path.join(dashboardDist, 'index.html'));
    } else {
        res.send('StayFlow Cloud Bot is running! Full Dashboard at: /admin or https://stay-flow-kohl.vercel.app');
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

setupCron();
