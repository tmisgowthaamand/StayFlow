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
import { handleIncomingMessage, sendMessage, sendMedia, setTenantContext, handleUpdateEB, createRazorpayLink } from './bot.js';
import setupCron from './cron.js';
import sheetsService from './sheets.js';
import wweb from './wweb.js';
import pdfService from './pdfService.js';
import { Log, Media, Tenant } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({
    origin: config.allowedOrigins.length > 0 ? config.allowedOrigins : '*',
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

            if (msg.type === 'interactive' && msg.interactive.button_reply) {
                text = msg.interactive.button_reply.title;
            }

            if (text || image) {
                console.log(`Received ${image ? 'image' : (msg.type === 'interactive' ? 'button click' : 'message')} from ${phone}: ${text}`);
                await handleIncomingMessage(phone, text, msg.id, image);
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
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

        await sheetsService.init();
        await sheetsService.addTenant({
            name,
            phone,
            room,
            sharingType: sharing,
            advance,
            monthlyRent: '0',
            aadhaarImage: file ? file.filename : ''
        });

        const detailedRules = `🏢 *PG House Rules & Regulations*\n━━━━━━━━━━━━━━━━━━━━\n⚖️ *DO's:*\n1. Keep your room and shared areas clean and hygienic.\n2. Maintain silence after 10:00 PM for everyone's comfort.\n3. Pay rent by the 5th and EB bills by the 10th of each month.\n4. Inform the admin 30 days before vacating.\n5. Cooperate with police verification and security checks.\n\n🚫 *DON'Ts:*\n1. Strictly NO smoking, alcohol, or illegal substances.\n2. No overnight visitors allowed without prior permission.\n3. Do not use heavy appliances (Heaters/AC/Iron) without approval.\n4. No loud music, parties, or disturbances in rooms.\n5. Do not damage PG property or furniture.\n\n📜 *Note:* Rules are for the safety and comfort of all residents.\n━━━━━━━━━━━━━━━━━━━━`;

        await sendMessage(phone, `✅ *Registration Successful!* 🎉\n\nWelcome ${name} to Room ${room}. We are happy to have you! 🏠\n\n${detailedRules}\n\n🤖 *How to Use:* Type *HI* anytime to see your dashboard!`);

        if (config.ownerPhone) {
            await sendMessage(config.ownerPhone, `📝 *New Web Registration*\n${name} - ${room}\nPhone: ${phone}\nAdvance: ₹${advance}`);
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

        await sheetsService.init();
        await sheetsService.addTenant(tenantData);

        if (config.ownerPhone) {
            await sendMessage(config.ownerPhone, `📝 *New Form Registration*\n\nName: ${tenantData.name}\nPhone: ${tenantData.phone}\nRoom: ${tenantData.room}\n\nPlease verify in the dashboard.`);
        }

        const detailedRules = `🏢 *PG House Rules & Regulations*\n━━━━━━━━━━━━━━━━━━━━\n⚖️ *DO's:*\n1. Keep your room and shared areas clean and hygienic.\n2. Maintain silence after 10:00 PM for everyone's comfort.\n3. Pay rent by the 5th and EB bills by the 10th of each month.\n4. Inform the admin 30 days before vacating.\n5. Cooperate with police verification and security checks.\n\n🚫 *DON'Ts:*\n1. Strictly NO smoking, alcohol, or illegal substances.\n2. No overnight visitors allowed without prior permission.\n3. Do not use heavy appliances (Heaters/AC/Iron) without approval.\n4. No loud music, parties, or disturbances in rooms.\n5. Do not damage PG property or furniture.\n\n📜 *Note:* Rules are for the safety and comfort of all residents.\n━━━━━━━━━━━━━━━━━━━━`;

        await sendMessage(tenantData.phone, `🎉 Hello ${tenantData.name}! Your registration is successful. ✅\n\nWelcome to *${config.businessName}*! 🏠\n\n${detailedRules}\n\n🤖 *Smart Bot:* Type *HI* to see your dashboard and bills!`);

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
        await sheetsService.addTenant(tenantData);
        const detailedRules = `🏢 *PG House Rules & Regulations*\n━━━━━━━━━━━━━━━━━━━━\n⚖️ *DO's:*\n1. Keep your room and shared areas clean and hygienic.\n2. Maintain silence after 10:00 PM for everyone's comfort.\n3. Pay rent by the 5th and EB bills by the 10th of each month.\n4. Inform the admin 30 days before vacating.\n5. Cooperate with police verification and security checks.\n\n🚫 *DON'Ts:*\n1. Strictly NO smoking, alcohol, or illegal substances.\n2. No overnight visitors allowed without prior permission.\n\n🤖 *Tip:* Type *HI* to see your dashboard!`;
        await sendMessage(tenantData.phone, `✅ *Registration Successful!*\n\nWelcome ${tenantData.name}! 🏠\n\n${detailedRules}`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/trigger-notifications', async (req, res) => {
    try {
        const tenants = await sheetsService.getAllTenants();
        res.json({ success: true, message: `Notification process started for ${tenants.length} recipients.` });

        (async () => {
            let sentCount = 0;
            for (const tenant of tenants) {
                const phone = tenant.get('Phone');
                const name = tenant.get('Name');
                const status = tenant.get('Status');
                if (!phone || status === 'VACATED') continue;

                try {
                    const rent = (tenant.get('Monthly Rent') || '0').toString().replace(/[^\d.]/g, '');
                    const eb = (tenant.get('EB Amount') || '0').toString().replace(/[^\d.]/g, '');
                    const total = parseFloat(rent) + parseFloat(eb);
                    const upiLink = `upi://pay?pa=${config.upiId}&pn=${encodeURIComponent(config.businessName)}&am=${total}&cu=INR`;
                    const razorpayLink = await createRazorpayLink(phone, name, total, tenant.get('Room'));

                    const tenantData = {
                        Name: name, Phone: phone, Room: tenant.get('Room'),
                        EB_Amount: eb, Monthly_Rent: rent, Total_Amount: total,
                        Paid_Date: 'PENDING', Transaction_ID: 'PENDING', Payment_Mode: 'PENDING'
                    };
                    const { fileName, filePath } = await pdfService.generateInvoice(tenantData);

                    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
                    let caption = `🔔 *Bill Reminder*\n\nHi ${name},\nTotal Due: *₹${total}*\n📅 *Due Date: 5th ${currentMonth}*`;
                    if (razorpayLink) caption += `\n\n💳 *Pay Online:* ${razorpayLink}`;
                    caption += `\n\n👇 *Pay via UPI:*\n${upiLink}`;

                    await sendMedia(phone, filePath, caption, ["💳 Paid by UPI", "💵 Paid by Cash"]);
                    sentCount++;
                    await new Promise(r => setTimeout(r, 1000));
                } catch (e) { console.error(`Failed to notify ${name}:`, e.message); }
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
        const upiLink = `upi://pay?pa=${config.upiId}&pn=${encodeURIComponent(config.businessName)}&am=${total}&cu=INR`;
        const razorpayLink = await createRazorpayLink(phone, name, total, tenant.get('Room'));

        let caption = `🧾 *Invoice & Payment*\n\nHi ${name},\n💰 *Total Due: ₹${total}*\n📅 *Due Date:* 5th ${currentMonth}`;
        if (razorpayLink) caption += `\n\n💳 *Pay Online:*\n${razorpayLink}`;
        caption += `\n\n👇 *Quick UPI Pay:*\n${upiLink}`;

        if (filePath) await sendMedia(phone, filePath, caption, ["💳 Paid by UPI", "💵 Paid by Cash"]);
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
        const success = await sheetsService.updateTenant(phone, {
            'Monthly Rent': rent.toString(), 'EB Amount': eb.toString(), 'Total Amount': total.toString()
        }, name);
        if (success) res.json({ success: true });
        else res.status(404).json({ error: 'Tenant not found' });
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
        const success = await sheetsService.updateTenant(phone, {
            'Status': 'PAID', 'Paid Date': new Date().toLocaleDateString(),
            'Transaction ID': `${mode.toUpperCase()}-${Date.now().toString().slice(-4)}`,
            'Payment Mode': mode
        }, name);
        if (!success) return res.status(404).json({ error: 'Tenant not found' });

        const tenant = await sheetsService.getTenantByPhone(phone, name);
        await sheetsService.logPayment(tenant, amount, mode, 'MANUAL-ENTRY');

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
        const tenants = await sheetsService.getTenantsJSON();
        let syncedCount = 0;

        for (const t of tenants) {
            // Upsert based on Name and Phone to avoid duplicates
            await Tenant.findOneAndUpdate(
                { phone: t.Phone, name: t.Name },
                {
                    room: t.Room,
                    bed: t.Bed,
                    floor: t.Floor,
                    location: t.Location,
                    sharingType: t['Sharing Type'],
                    advance: t.Advance,
                    monthlyRent: t['Monthly Rent'],
                    ebAmount: t['EB Amount'],
                    totalAmount: t['Total Amount'],
                    status: t.Status,
                    joinDate: t['Join Date'],
                    paidDate: t['Paid Date'],
                    aadhaarImage: t['Aadhaar Image']
                },
                { upsert: true, new: true }
            );
            syncedCount++;
        }

        res.json({ success: true, count: syncedCount });
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
