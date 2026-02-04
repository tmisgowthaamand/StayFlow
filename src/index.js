const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const config = require('./config');
const { handleIncomingMessage } = require('./bot');
const setupCron = require('./cron');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Serve uploads statically
app.use('/api/uploads', express.static(uploadsDir));

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

            // Handle Button Replies
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

const sheetsService = require('./sheets');
const bot = require('./bot');
const wweb = require('./wweb');

// Initialize WWeb for Free Automation
wweb.init();

const { setTenantContext, handleUpdateEB } = bot;

// Proxy for WhatsApp Media
app.get('/api/media/:id', async (req, res) => {
    try {
        const mediaId = req.params.id;
        const uploadsDir = path.join(__dirname, '../uploads');
        // Clean mediaId to prevent directory traversal
        const safeMediaId = path.basename(mediaId);
        const localPath = path.join(uploadsDir, safeMediaId);

        console.log(`Media Request: ${safeMediaId}`);

        // 1. Check if it's a local file
        if (fs.existsSync(localPath) && fs.lstatSync(localPath).isFile()) {
            console.log(`Serving local media: ${safeMediaId}`);

            // If no extension, try to detect or default to image/jpeg if it looks like a multer/wweb file
            const ext = path.extname(safeMediaId).toLowerCase();
            if (!ext) {
                // Heuristic: If it's a 32-char hex string (Multer) or starts with wweb_
                if (/^[a-f0-9]{32}$/i.test(safeMediaId) || safeMediaId.startsWith('wweb_')) {
                    res.setHeader('Content-Type', 'image/jpeg');
                }
            }

            return res.sendFile(localPath);
        }

        // 2. If not local, try WhatsApp Cloud API
        console.log(`Fetching remote media from WhatsApp: ${mediaId}`);
        const urlRes = await axios.get(`https://graph.facebook.com/v17.0/${mediaId}`, {
            headers: { Authorization: `Bearer ${config.whatsapp.token}` }
        });

        const mediaUrl = urlRes.data.url;

        // 3. Stream Media Content from FB
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
        // Mocking owner phone for this request
        await handleUpdateEB(config.ownerPhone, room, totalEB);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// File Upload Config
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

app.post('/api/upload-aadhaar', upload.single('aadhaar'), async (req, res) => {
    try {
        const { phone } = req.body;
        const file = req.file;
        if (!file || !phone) return res.status(400).json({ error: 'File and phone required' });

        // Save to Sheet (store filename or id)
        await sheetsService.updateTenant(phone, {
            'Aadhaar Image': file.filename
        });

        res.json({ success: true, filename: file.filename });
    } catch (err) {
        console.error('File Upload Error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// WEB REGISTRATION ENDPOINT
app.post('/api/web-register', upload.single('aadhaar'), async (req, res) => {
    try {
        const { name, phone, room, sharing, advance } = req.body;
        const file = req.file;

        console.log(`Web Registration: ${name} (${phone})`);

        // Add to Sheet
        await sheetsService.init();
        await sheetsService.addTenant({
            name,
            phone,
            room,
            sharingType: sharing,
            advance,
            monthlyRent: '0', // Will set later or default
            aadhaarImage: file ? file.filename : ''
        });

        // Notify Tenant & Owner
        const rules = `🏠 *StayFlow Rules*\n\n1. Gate closes 10:30 PM.\n2. Rent due by 5th.\n3. Keep room clean.\n\n📋 Full Rules: ${req.protocol}://${req.get('host')}/rules.html`;

        await bot.sendMessage(phone, `✅ *Registration Successful!* \n\nWelcome ${name} to Room ${room}. \n\n${rules}`);

        if (config.ownerPhone) {
            await bot.sendMessage(config.ownerPhone, `📝 *New Web Registration*\n${name} - ${room}\nPhone: ${phone}\nAdvance: ₹${advance}`);
        }

        // Redirect to rules page
        res.redirect('/rules.html');

    } catch (err) {
        console.error('Web Reg Error:', err);
        res.status(500).send('Registration Failed: ' + err.message);
    }
});

const pdfService = require('./pdfService');

// Google Form Webhook
app.post('/webhook/google-form', async (req, res) => {
    try {
        const data = req.body;
        console.log('Google Form Submission Received:', data);

        // Normalize data from Form
        const tenantData = {
            name: data.Name || data['Full Name'],
            phone: data.Phone || data['Phone Number'],
            room: data.Room || 'Unassigned',
            sharingType: data['Sharing Type'] || 'Unknown',
            advance: data.Advance || '0',
            aadhaarImage: data['Aadhaar Image Link'] || data['Aadhaar Image'] || data['Aadhaar'],
            monthlyRent: data['Monthly Rent'] || '0'
        };

        // Add to Sheet
        await sheetsService.init();
        await sheetsService.addTenant(tenantData);

        // Notify Owner
        if (config.ownerPhone) {
            await bot.sendMessage(config.ownerPhone, `📝 *New Form Registration*\n\nName: ${tenantData.name}\nPhone: ${tenantData.phone}\nRoom: ${tenantData.room}\n\nPlease verify in the dashboard.`);
        }

        // Notify Tenant with Rules
        const rules = `🏠 *StayFlow PG House Rules*\n\n1. *Gate Timings:* 10:30 PM (Inform warden for late entry).\n2. *Payments:* Before 5th of every month.\n3. *Discipline:* No damage to property, maintain cleanliness.\n4. *Visitors:* Limited hours, no overnight stay without permission.\n5. *Rent:* Fixed monthly rent + EB sharing.\n\nType *HI* to see your dashboard!`;
        await bot.sendMessage(tenantData.phone, `🎉 Hello ${tenantData.name}! Your registration is successful.\n\n${rules}`);

        res.json({ success: true });
    } catch (err) {
        console.error('Form Webhook Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin Dashboard API
app.get('/api/tenants', async (req, res) => {
    try {
        const tenants = await sheetsService.getTenantsJSON();
        res.json(tenants);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/add-tenant', async (req, res) => {
    try {
        const tenantData = req.body;
        await sheetsService.addTenant(tenantData);

        // Notify Tenant
        const rules = `🏠 *StayFlow PG House Rules*\n\n1. *Gate Timings:* 10:30 PM.\n2. *Payments:* Before 5th of every month.\n3. *Discipline:* maintain cleanliness.\n\nWelcome ${tenantData.name}! Type *HI* to see your dashboard!`;
        await bot.sendMessage(tenantData.phone, rules);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/trigger-notifications', async (req, res) => {
    try {
        console.log('Mass Notification Triggered (Running in Background)');
        const tenants = await sheetsService.getAllTenants();

        // Immediate response to prevent timeout
        res.json({ success: true, message: `Notification process started for ${tenants.length} potential recipients.` });

        // Run the distribution in the background
        (async () => {
            let sentCount = 0;
            let failCount = 0;

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
                    const razorpayLink = await bot.createRazorpayLink(phone, name, total, tenant.get('Room'));

                    const tenantData = {
                        Name: name,
                        Phone: phone,
                        Room: tenant.get('Room'),
                        EB_Amount: eb,
                        Monthly_Rent: rent,
                        Total_Amount: total,
                        Paid_Date: 'PENDING',
                        Transaction_ID: 'PENDING',
                        Payment_Mode: 'PENDING'
                    };
                    const { fileName } = await pdfService.generateInvoice(tenantData);
                    const filePath = path.join(__dirname, '../uploads', fileName);

                    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
                    let caption = `🔔 *Bill Reminder*\n\nHi ${name},\nHere is your pending invoice for *${currentMonth}*.\nTotal Due: *₹${total}*\n\n📅 *Due Date: 5th ${currentMonth}*`;

                    if (razorpayLink) caption += `\n\n💳 *Pay Online:* ${razorpayLink}`;
                    caption += `\n\n👇 *Pay via UPI:*\n${upiLink}`;

                    await bot.sendImage(phone, filePath, caption);
                    sentCount++;

                    // Small delay to avoid rate limiting
                    await new Promise(r => setTimeout(r, 1000));
                } catch (innerErr) {
                    failCount++;
                    console.error(`Failed to notify ${name}:`, innerErr.message);
                    fs.appendFileSync('debug.log', `[${new Date().toISOString()}] Background Notify Fail (${name}): ${innerErr.message}\n`);
                }
            }
            console.log(`Background notification batch complete: ${sentCount} sent, ${failCount} failed.`);
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] Batch Complete: ${sentCount} sent, ${failCount} failed.\n`);
        })();

    } catch (err) {
        console.error('Mass Notify Critical Error:', err);
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
            Name: tenant.get('Name'),
            Phone: tenant.get('Phone'),
            Room: tenant.get('Room'),
            EB_Amount: eb,
            Monthly_Rent: rent,
            Total_Amount: total,
            Paid_Date: tenant.get('Status') === 'PAID' ? (tenant.get('Paid Date') || 'N/A') : 'PENDING',
            Transaction_ID: tenant.get('Transaction ID') || 'PENDING',
            Payment_Mode: tenant.get('Payment Mode') || 'PENDING'
        };

        const { fileName } = await pdfService.generateInvoice(tenantData);
        res.json({ success: true, url: `/api/uploads/${fileName}` });
    } catch (err) {
        console.error('Generate Invoice Error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/notify-tenant', async (req, res) => {
    try {
        const { phone, name: requestedName } = req.body;
        console.log(`Received notification request for: ${requestedName} (${phone})`);
        const tenant = await sheetsService.getTenantByPhone(phone, requestedName);
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        const name = tenant.get('Name');
        setTenantContext(phone, name);
        const rent = (tenant.get('Monthly Rent') || '0').toString().replace(/[^\d.]/g, '');
        const eb = (tenant.get('EB Amount') || '0').toString().replace(/[^\d.]/g, '');
        const total = parseFloat(rent) + parseFloat(eb);

        console.log(`Rendering PDF receipt for: ${name} | Total: ${total}`);

        // Generate Invoice PDF (Soft Fail)
        let filePath = null;
        try {
            const tenantData = {
                Name: name,
                Phone: tenant.get('Phone'),
                Room: tenant.get('Room'),
                EB_Amount: eb,
                Monthly_Rent: rent,
                Total_Amount: total,
                Paid_Date: 'PENDING',
                Transaction_ID: 'PENDING',
                Payment_Mode: 'PENDING'
            };
            const result = await pdfService.generateInvoice(tenantData);
            filePath = result.filePath;
            console.log(`PDF result: ${result.fileName}`);
        } catch (pdfErr) {
            console.error('PDF Generation Failed:', pdfErr);
        }

        const currentMonth = new Date().toLocaleString('default', { month: 'long' });
        const dueDate = `5th ${currentMonth}`;
        const upiLink = `upi://pay?pa=${config.upiId}&pn=${encodeURIComponent(config.businessName)}&am=${total}&cu=INR`;
        const razorpayLink = await bot.createRazorpayLink(phone, name, total, tenant.get('Room'));

        let caption = `🧾 *Invoice & Payment Options*\n\nHi ${name},\nHere is your bill for *${currentMonth}*.\n\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n💰 *Total Due: ₹${total}*\n\n📅 *Due Date:* ${dueDate}`;

        if (razorpayLink) {
            caption += `\n\n💳 *Pay Online (Card/UPI/Netbanking):*\n${razorpayLink}`;
        }
        caption += `\n\n👇 *Quick UPI Pay:*\n${upiLink}`;

        // Send PDF with Caption (Uses bot.sendImage which handles both wweb & Cloud API)
        try {
            if (filePath) {
                await bot.sendImage(phone, filePath, caption);
            } else {
                await bot.sendMessage(phone, caption);
            }
        } catch (imgErr) {
            console.error('All image sending methods failed:', imgErr);
            await bot.sendMessage(phone, caption);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Critical Notify Error:', err);
        const errorLog = `[${new Date().toISOString()}] NOTIFY ERROR: ${err.message}\nSTACK: ${err.stack}\n`;
        fs.appendFileSync('errors.log', errorLog);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/update-bill', async (req, res) => {
    try {
        const { phone, name, rent, eb } = req.body;
        const total = parseFloat(rent) + parseFloat(eb);

        const success = await sheetsService.updateTenant(phone, {
            'Monthly Rent': rent.toString(),
            'EB Amount': eb.toString(),
            'Total Amount': total.toString()
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

        console.log(`Silent Update Request for: ${oldName || name} -> ${name} (${phoneToUse})`);

        // Use fallbacks to avoid .toString() on undefined
        const safeRent = (rent || '0').toString();
        const safeEb = (eb || '0').toString();
        const total = parseFloat(safeRent.replace(/[^\d.]/g, '')) + parseFloat(safeEb.replace(/[^\d.]/g, ''));

        // 1. Update Sheet - IMPORTANT: Use oldName to find the correct record if name is being changed
        const updateData = {
            'Name': name || oldName,
            'Phone': newPhone || phoneToUse,
            'Monthly Rent': safeRent,
            'EB Amount': safeEb,
            'Total Amount': total.toString(),
            'Sharing Type': sharingType || 'Unknown',
            'Location': location || 'Main Branch'
        };

        // Remove any undefined values just in case
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) updateData[key] = '';
        });

        const success = await sheetsService.updateTenant(phoneToUse, updateData, oldName || name);

        if (!success) {
            console.error(`Update Failed: Tenant ${oldName || name} (${phoneToUse}) not found`);
            return res.status(404).json({ error: 'Resident not found. Please refresh and try again.' });
        }

        // Silent Update: No notification sent here. 
        // Notifications are now manually triggered via the Bell icon (api/notify-tenant).

        res.json({ success: true });
    } catch (err) {
        console.error('Update error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/mark-paid', async (req, res) => {
    try {
        const { phone, name, amount, mode } = req.body;
        console.log(`Marking paid: ${name} - ₹${amount} (${mode})`);

        // 1. Update Sheet
        const success = await sheetsService.updateTenant(phone, {
            'Status': 'PAID',
            'Paid Date': new Date().toLocaleDateString(),
            'Transaction ID': `${mode.toUpperCase()}-${Date.now().toString().slice(-4)}`,
            'Payment Mode': mode
        }, name);

        if (!success) return res.status(404).json({ error: 'Tenant not found' });

        // 2. Log History
        const tenant = await sheetsService.getTenantByPhone(phone, name);
        await sheetsService.logPayment(tenant, amount, mode, 'MANUAL-ENTRY');

        // 3. Generate Receipt PDF
        const tenantData = {
            Name: tenant.get('Name'),
            Phone: tenant.get('Phone'),
            Room: tenant.get('Room'),
            EB_Amount: tenant.get('EB Amount') || '0',
            Monthly_Rent: tenant.get('Monthly Rent') || '0',
            Total_Amount: amount,
            Paid_Date: new Date().toLocaleDateString(),
            Transaction_ID: mode.toUpperCase(),
            Payment_Mode: mode
        };
        const { fileName, filePath } = await pdfService.generateInvoice(tenantData);

        // 4. Send Confirmation to Tenant
        const receiptMsg = `✅ *Payment Received*\n\nHi ${name},\nWe have received your payment of ₹${amount} via ${mode}.\n\n📎 *Invoice Generated:* Attached below.\n\nThank you for paying on time!`;

        // Use bot.sendMessage/bot.sendImage for robustness (handles wweb fallback)
        await bot.sendMessage(phone, receiptMsg);
        await bot.sendImage(phone, filePath, "Here is your invoice");

        // 5. Notify Owner
        if (config.ownerPhone) {
            await bot.sendMessage(config.ownerPhone, `💰 *Money In*\n\nTenant: ${name} (${tenant.get('Room')})\nAmount: ₹${amount}\nMode: ${mode}\nStatus: Marked PAID`);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Mark Paid Error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/delete-tenant', async (req, res) => {
    try {
        const { phone, name } = req.body;
        console.log(`Deleting tenant: ${name} (${phone})`);

        const success = await sheetsService.deleteTenant(phone, name);
        if (success) {
            // Optional: Notify tenant or just owner? keeping it silent for now
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Tenant not found to delete' });
        }
    } catch (err) {
        console.error('Delete error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/broadcast', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const tenants = await sheetsService.getTenantsJSON();
        const activeTenants = tenants.filter(t => t.Status !== 'VACATED');

        for (const t of activeTenants) {
            if (!t.Phone) continue;
            const broadcastMsg = `📢 *StayFlow Announcement*\n\n${message}`;
            await bot.sendMessage(t.Phone, broadcastMsg);
        }

        res.json({ success: true, count: activeTenants.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== LOCATIONS API ====================

app.get('/api/locations', async (req, res) => {
    try {
        const locations = await sheetsService.getAllLocations();
        res.json(locations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/locations', async (req, res) => {
    try {
        const { name, address, totalRooms, floors, totalBeds, notes } = req.body;
        await sheetsService.addLocation({ name, address, totalRooms, floors, totalBeds, notes });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== EB BILLS API ====================

app.get('/api/eb-bills', async (req, res) => {
    try {
        const { location } = req.query;
        const bills = await sheetsService.getEBBillsByLocation(location || 'Main Branch');
        res.json(bills);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/eb-bills', async (req, res) => {
    try {
        const { monthYear, location, totalUnits, ratePerUnit, notes } = req.body;
        const result = await sheetsService.addEBBill({ monthYear, location, totalUnits, ratePerUnit, notes });

        // Calculate per-tenant EB and update all tenants at this location
        const tenants = await sheetsService.getTenantsByLocation(location || 'Main Branch');
        const activeTenants = tenants.filter(t => t.get('Status') !== 'VACATED');

        if (activeTenants.length > 0) {
            const perPersonEB = Math.round(result.totalEB / activeTenants.length);

            for (const tenant of activeTenants) {
                const phone = tenant.get('Phone');
                const name = tenant.get('Name');
                const rent = parseFloat(tenant.get('Monthly Rent') || 0);
                const total = rent + perPersonEB;

                await sheetsService.updateTenant(phone, {
                    'EB Amount': perPersonEB.toString(),
                    'Total Amount': total.toString()
                }, name);
            }
        }

        res.json({
            success: true,
            totalEB: result.totalEB,
            perPersonEB: activeTenants.length > 0 ? Math.round(result.totalEB / activeTenants.length) : 0,
            tenantsUpdated: activeTenants.length
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== DASHBOARD STATS API ====================

app.get('/api/dashboard-stats', async (req, res) => {
    try {
        const stats = await sheetsService.getDashboardStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== ROOM MAP API ====================

app.get('/api/room-map', async (req, res) => {
    try {
        const { location } = req.query;
        const roomMap = await sheetsService.getRoomMap(location);
        res.json(roomMap);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== NOTIFICATIONS LOG API ====================

app.get('/api/notifications', async (req, res) => {
    try {
        const { phone } = req.query;
        if (phone) {
            const notifications = await sheetsService.getNotificationsByPhone(phone, 20);
            res.json(notifications.map(n => ({
                phone: n.get('Phone'),
                name: n.get('Name'),
                type: n.get('Message Type'),
                date: n.get('Sent Date'),
                content: n.get('Content'),
                status: n.get('Status')
            })));
        } else {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/log-notification', async (req, res) => {
    try {
        const { phone, name, type, content } = req.body;
        await sheetsService.logNotification(phone, name, type, content);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== TENANTS BY LOCATION ====================

app.get('/api/tenants-by-location', async (req, res) => {
    try {
        const { location } = req.query;
        if (!location) {
            return res.json(await sheetsService.getTenantsJSON());
        }
        const tenants = await sheetsService.getTenantsByLocation(location);
        res.json(tenants.map(row => {
            const data = {};
            ['Name', 'Phone', 'Room', 'Bed', 'Floor', 'Location', 'Sharing Type',
                'Advance', 'Monthly Rent', 'EB Amount', 'Total Amount', 'Status', 'Join Date', 'Paid Date'
            ].forEach(header => {
                data[header] = row.get(header) || '';
            });
            return data;
        }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/', (req, res) => {
    res.send('StayFlow Cloud Bot is running! Visit /admin for Dashboard.');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Webhook URL: ${config.whatsapp.callbackUrl || `http://localhost:${port}/webhook`}`);
});

// Setup Automation (Cron)
setupCron();
