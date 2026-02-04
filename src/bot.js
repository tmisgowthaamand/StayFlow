const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const config = require('./config');
const sheetsService = require('./sheets');
const Groq = require('groq-sdk');
const Razorpay = require('razorpay');
const { Log, Media } = require('./db');

const groq = new Groq({ apiKey: config.groqApiKey });

let razorpay = null;
if (config.razorpay.key_id && config.razorpay.key_secret) {
    razorpay = new Razorpay({
        key_id: config.razorpay.key_id,
        key_secret: config.razorpay.key_secret,
    });
}

const userState = {};

async function createRazorpayLink(phone, name, amount, room = 'N/A') {
    if (!razorpay || amount <= 0) return null;
    try {
        const paymentLink = await razorpay.paymentLink.create({
            amount: Math.round(amount * 100), // Amount in paise
            currency: "INR",
            accept_partial: false,
            description: `StayFlow Rent & EB - ${name} (Room ${room})`,
            customer: {
                name: name,
                contact: phone.toString().slice(-10),
                email: "tenant@stayflow.com"
            },
            notify: {
                sms: true,
                email: true
            },
            reminder_enable: true,
            notes: {
                room: room
            }
        });
        return paymentLink.short_url;
    } catch (err) {
        console.error('Razorpay Link Generation Failed:', err.message);
        return null;
    }
}

async function validateInputWithAI(step, input) {
    if (!config.groqApiKey) return { isValid: true };

    const prompts = {
        'NAME': `Check if "${input}" is a valid human full name. If it's gibberish like "asdf", "123", or just one letter, it's invalid. Reply only in JSON: {"isValid": boolean, "message": "friendly correction message if invalid or empty string"}`,
        'PHONE_NUMBER': `Check if "${input}" is a valid phone number. It should be 10-12 digits. Reply only in JSON: {"isValid": boolean, "message": "friendly correction message if invalid"}`,
        'ROOM': `Check if "${input}" is a valid room identifier (like 101, G1, 203, etc). Reply only in JSON: {"isValid": boolean, "message": "friendly correction message if invalid"}`,
        'ADVANCE': `Check if "${input}" is a valid monetary amount or number. Reply only in JSON: {"isValid": boolean, "message": "friendly correction message if invalid"}`,
        'MONEY': `Check if "${input}" is a valid monetary amount (numbers only). Reply only in JSON: {"isValid": boolean, "message": "friendly correction message if invalid"}`,
        'DATE': `Check if "${input}" is a valid date (like DD/MM/YYYY or 2nd Feb). Reply only in JSON: {"isValid": boolean, "message": "friendly correction message if invalid"}`,
        'TRANS_ID': `Check if "${input}" looks like a valid UPI Transaction ID or reference number. Reply only in JSON: {"isValid": boolean, "message": "friendly correction message if invalid"}`
    };

    if (!prompts[step]) return { isValid: true };

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompts[step] }],
            model: 'llama3-8b-8192',
            response_format: { type: 'json_object' }
        });
        return JSON.parse(chatCompletion.choices[0].message.content);
    } catch (err) {
        console.error('AI Validation Error:', err.message);
        return { isValid: true }; // Fallback to avoid blocking user
    }
}



/**
 * Sets the current tenant context for a phone number.
 * Used to distinguish tenants sharing the same phone number for testing.
 */
function setTenantContext(phone, name) {
    if (!userState[phone]) userState[phone] = {};
    userState[phone].contextName = name;
}

function normalizePhone(phone) {
    if (!phone) return '';
    let clean = phone.toString().replace(/\D/g, '');
    if (clean.length === 10) clean = '91' + clean;
    return clean;
}

async function sendMessage(to, text) {
    const wweb = require('./wweb');
    if (wweb.ready) {
        await wweb.sendMessage(to, text);
        return;
    }

    const cleanTo = normalizePhone(to);
    try {
        const response = await axios.post(
            `https://graph.facebook.com/v17.0/${config.whatsapp.phoneNumberId}/messages`,
            {
                messaging_product: "whatsapp",
                to: cleanTo,
                type: "text",
                text: { body: text },
            },
            {
                headers: { Authorization: `Bearer ${config.whatsapp.token}` },
            }
        );
        logToFile(`Message sent successfully to ${cleanTo}. Response ID: ${response.data.messages[0].id}`);
    } catch (err) {
        logToFile(`Error sending message to ${cleanTo}: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
    }
}

async function sendButtons(to, text, buttons) {
    const cleanTo = normalizePhone(to);
    try {
        await axios.post(
            `https://graph.facebook.com/v17.0/${config.whatsapp.phoneNumberId}/messages`,
            {
                messaging_product: "whatsapp",
                to: cleanTo,
                type: "interactive",
                interactive: {
                    type: "button",
                    body: { text: text },
                    action: {
                        buttons: buttons.map((btn, i) => ({
                            type: "reply",
                            reply: { id: `btn_${i}`, title: btn }
                        }))
                    }
                }
            },
            { headers: { Authorization: `Bearer ${config.whatsapp.token}` } }
        );
    } catch (err) {
        console.error('Error sending buttons:', err.response ? err.response.data : err.message);
    }
}

async function sendImage(to, imagePath, caption = "") {
    try {
        const wweb = require('./wweb');
        const cleanTo = normalizePhone(to);
        const extension = path.extname(imagePath).toLowerCase();
        const isPdf = extension === '.pdf';

        // 1. Try WWeb first (Free, no 24h window limit)
        if (wweb.ready) {
            try {
                await wweb.sendImage(to, imagePath, caption);
                return;
            } catch (wwebErr) {
                console.error('WWeb sendImage failed, falling back to Cloud API:', wwebErr.message);
            }
        }

        // 2. Try Cloud API Fallback
        const mediaId = await uploadMedia(imagePath);
        if (!mediaId) {
            console.error('Failed to upload media for Cloud API');
            return;
        }

        await axios.post(
            `https://graph.facebook.com/v17.0/${config.whatsapp.phoneNumberId}/messages`,
            {
                messaging_product: "whatsapp",
                to: cleanTo,
                type: isPdf ? "document" : "image",
                [isPdf ? "document" : "image"]: {
                    id: mediaId,
                    caption: caption,
                    filename: isPdf ? path.basename(imagePath) : undefined
                },
            },
            {
                headers: { Authorization: `Bearer ${config.whatsapp.token}` },
            }
        );
    } catch (err) {
        console.error('sendImage fully failed:', err.response ? JSON.stringify(err.response.data) : err.message);
        // Do not throw, index.js relies on this not crashing
    }
}

async function uploadMedia(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            console.error('File not found:', filePath);
            return null;
        }

        const extension = path.extname(filePath).toLowerCase();
        const mimeType = extension === '.pdf' ? 'application/pdf' : 'image/jpeg';

        const data = new FormData();
        data.append('messaging_product', 'whatsapp');
        data.append('file', fs.createReadStream(filePath));
        data.append('type', mimeType);

        const response = await axios.post(
            `https://graph.facebook.com/v17.0/${config.whatsapp.phoneNumberId}/media`,
            data,
            {
                headers: {
                    ...data.getHeaders(),
                    Authorization: `Bearer ${config.whatsapp.token}`,
                },
            }
        );

        return response.data.id;
    } catch (err) {
        console.error('Error uploading media:', err.response ? err.response.data : err.message);
        return null;
    }
}

const logFile = path.join(__dirname, '../bot.log');
function logToFile(msg) {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
    console.log(msg);
}

async function handleIncomingMessage(phone, body, messageId = null, image = null) {
    logToFile(`Incoming: ${phone} | Body: ${body} | Image: ${!!image}`);
    const cleanBody = (body || '').trim().toUpperCase();

    // Log the activity to MongoDB (Non-blocking)
    Log.create({
        phone,
        action: 'INCOMING_MESSAGE',
        details: { body, image, messageId }
    }).catch(err => logToFile(`Logging to MongoDB failed: ${err.message}`));

    logToFile(`Current CleanBody: ${cleanBody}`);
    if (userState[phone]) {
        logToFile(`User ${phone} is in state: ${JSON.stringify(userState[phone])}`);
        await handleOnboarding(phone, body, image);
        return;
    }

    // 2. Check for Smart Payment Detection (e.g., "Paid 7000 by cash" or "Paid TRX12345")
    const isPaymentAction = await handleSmartPayment(phone, body);
    if (isPaymentAction) return;

    // 3. Handle Commands
    switch (cleanBody) {
        case config.commands.JOIN:
            // Google Form Onboarding
            const joinBanner = path.join(__dirname, '../assets/JOIN.png');
            if (fs.existsSync(joinBanner)) await sendImage(phone, joinBanner);

            const formUrl = config.googleFormUrl || 'https://forms.gle/YOUR_FORM_ID'; // Ensure this is set in config
            await sendMessage(phone, `Welcome 👋\nTo join StayFlow, please fill out this quick registration form:\n\n👉 ${formUrl}\n\nOnce submitted, you will receive a confirmation here!`);
            break;

        case config.commands.RENT:
            await handleRent(phone);
            break;

        case config.commands.EB:
            await handleEB(phone);
            break;

        case config.commands.STATUS:
            await handleStatus(phone);
            break;

        case config.commands.PAID:
            userState[phone] = { step: 'PAYMENT_PROOF' };
            await sendMessage(phone, `Please send transaction ID (and share screenshot if possible).`);
            break;

        case config.commands.CASH_PAID:
            userState[phone] = { step: 'CASH_AMOUNT' };
            await sendMessage(phone, `Amount paid?`);
            break;

        case config.commands.HELP:
            await sendButtons(phone, "How can we help you today?", ["Food", "Payment", "Maintenance", "Other"]);
            userState[phone] = { step: 'HELP_REASON' };
            break;

        case 'ADVANCE':
            await handleAdvance(phone);
            break;

        case config.commands.LEAVE:
        case config.commands.VACATE:
        case 'VACATING':
            await handleTenantVacateRequest(phone);
            break;

        case 'HISTORY':
        case 'PREVIOUS PAYMENT':
            const tenantForHistory = await sheetsService.getTenantByPhone(phone);
            if (!tenantForHistory) {
                await sendMessage(phone, `You are not registered. Type JOIN to start.`);
                break;
            }

            try {
                const paymentHistory = await sheetsService.getPaymentHistory(phone, 6);
                const oldHistory = await sheetsService.getHistoryByPhone(phone);

                let historyMsg = `📜 *Payment History*\n━━━━━━━━━━━━━━━━━━━━\n\n`;

                if (paymentHistory && paymentHistory.length > 0) {
                    paymentHistory.forEach((h, i) => {
                        const monthYear = h.get('Month-Year') || 'Unknown';
                        const amount = h.get('Total Amount') || '0';
                        const mode = h.get('Payment Mode') || 'N/A';
                        const pStatus = h.get('Status') || 'PAID';
                        const pEmoji = pStatus === 'PAID' ? '✅' : '⏳';
                        historyMsg += `${pEmoji} *${monthYear}*\n   Amount: ₹${amount}\n   Mode: ${mode}\n\n`;
                    });
                } else if (oldHistory.length > 0) {
                    oldHistory.slice(-6).reverse().forEach(h => {
                        const month = h.get('Month') || '';
                        const year = h.get('Year') || '';
                        const amount = h.get('Amount') || '0';
                        const mode = h.get('Mode') || 'N/A';
                        historyMsg += `✅ *${month} ${year}*\n   Amount: ₹${amount}\n   Mode: ${mode}\n\n`;
                    });
                } else {
                    historyMsg += `No payment history found yet.\n\n`;
                }

                historyMsg += `━━━━━━━━━━━━━━━━━━━━\n_Need to add old payment? Send screenshot._`;
                await sendMessage(phone, historyMsg);
            } catch (err) {
                console.error('History Error:', err);
                await sendMessage(phone, `Unable to fetch history. Please try again later.`);
            }
            break;

        // Admin Commands
        case 'TOTAL TENANTS':
            await handleAdminTotal(phone);
            break;
        case 'PAID LIST':
            await handleAdminList(phone, 'PAID');
            break;
        case 'PENDING LIST':
            await handleAdminList(phone, 'PENDING');
            break;
        case 'DASHBOARD':
            await handleDashboard(phone);
            break;
        case 'SEND BILL':
            await handleSendBillAll(phone);
            break;
        case 'SEND REMINDER':
            await handleSendReminder(phone);
            break;
        case 'ANNOUNCE':
            userState[phone] = { step: 'ANNOUNCE_MSG' };
            await sendMessage(phone, `What is the announcement?`);
            break;

        case 'HI':
        case 'HELLO':
            const tenantForHi = await sheetsService.getTenantByPhone(phone);
            if (tenantForHi && tenantForHi.get('Status') !== 'VACATED') {
                const name = tenantForHi.get('Name');
                const room = tenantForHi.get('Room') || 'N/A';
                const rent = parseFloat(tenantForHi.get('Monthly Rent') || 0);
                const eb = parseFloat(tenantForHi.get('EB Amount') || 0);
                const total = rent + eb;
                const status = tenantForHi.get('Status') || 'ACTIVE';
                const location = tenantForHi.get('Location') || 'Main Branch';

                // Get current month info
                const now = new Date();
                const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                const currentMonth = monthNames[now.getMonth()];
                const dueDate = `${config.rentDueDate}th ${currentMonth}`;

                // Build status indicator
                const statusEmoji = status === 'PAID' ? '✅' : (status === 'PENDING' ? '⏳' : '🔔');

                // === PAYMENT HISTORY (Last 3 months) ===
                let historyText = '';
                try {
                    const paymentHistory = await sheetsService.getPaymentHistory(phone, 3);
                    if (paymentHistory && paymentHistory.length > 0) {
                        historyText = '\n\n📊 *Past Payments:*\n';
                        paymentHistory.forEach(h => {
                            const monthYear = h.get('Month-Year') || 'Unknown';
                            const amount = h.get('Total Amount') || '0';
                            const pStatus = h.get('Status') || 'PAID';
                            const pEmoji = pStatus === 'PAID' ? '✅' : '⏳';
                            historyText += `${pEmoji} ${monthYear}: ₹${amount}\n`;
                        });
                    } else {
                        // Fallback to History sheet
                        const oldHistory = await sheetsService.getHistoryByPhone(phone);
                        if (oldHistory.length > 0) {
                            historyText = '\n\n📊 *Past Payments:*\n';
                            oldHistory.slice(-3).reverse().forEach(h => {
                                const month = h.get('Month') || '';
                                const year = h.get('Year') || '';
                                const amount = h.get('Amount') || '0';
                                historyText += `✅ ${month} ${year}: ₹${amount}\n`;
                            });
                        }
                    }
                } catch (err) {
                    console.error('Error fetching payment history:', err.message);
                }

                // === BUILD DASHBOARD MESSAGE ===
                const dashboardMsg = `━━━━━━━━━━━━━━━━━━━━━
🏠 *${config.businessName} Portal*
━━━━━━━━━━━━━━━━━━━━━

Welcome back, *${name}*! 👋

📍 *Your Details:*
🚪 Room: ${room}
📌 Location: ${location}
${statusEmoji} Status: *${status}*

💰 *Upcoming Bill - ${currentMonth}:*
┌─────────────────────
│ 🏠 Rent: ₹${rent}
│ ⚡ EB: ₹${eb}
└─────────────────────
💵 *Total Due: ₹${total}*
📅 *Due Date: ${dueDate}*${historyText}

━━━━━━━━━━━━━━━━━━━━━
⚡ *Quick Actions:*
━━━━━━━━━━━━━━━━━━━━━
📋 Type *RENT* - View bill & pay
📜 Type *HISTORY* - Full payment history
🚪 Type *VACATE* - Request to leave
🆘 Type *HELP* - Raise complaint

_Reply with any option above_`;

                await sendMessage(phone, dashboardMsg);

                // Log notification
                try {
                    await sheetsService.logNotification(phone, name, 'DASHBOARD_VIEW', 'Tenant viewed dashboard via HI command');
                } catch (e) { }

            } else {
                const welcomeBanner = path.join(__dirname, '../assets/START BANNER.png');
                if (fs.existsSync(welcomeBanner)) await sendImage(phone, welcomeBanner);
                await sendMessage(phone, `Hello! 👋 Welcome to ${config.businessName}.\n\nTo get started, please register with us:\n\n👉 Type *JOIN* to Register\n\nIf you are already a member, please contact the admin if your number has changed.`);
            }
            break;

        default:
            // Check for Admin/Owner commands with parameters
            if (phone === config.ownerPhone) {
                if (cleanBody.startsWith('SET EB')) {
                    const parts = cleanBody.split(' ');
                    if (parts.length === 4) {
                        const room = parts[2];
                        const units = parts[3];
                        await handleUpdateEB(phone, room, units);
                        return;
                    } else {
                        await sendMessage(phone, `Usage: SET EB [ROOM] [UNITS]\nExample: SET EB 101 100`);
                        return;
                    }
                }

                if (cleanBody.startsWith('VACATE')) {
                    const room = cleanBody.split(' ')[1];
                    await handleVacate(phone, room);
                    return;
                }

                if (cleanBody.startsWith('MARK CASH')) {
                    const parts = cleanBody.split(' ');
                    if (parts.length >= 3) {
                        const tenantPhone = parts[2];
                        await handleMarkCash(phone, tenantPhone);
                        return;
                    }
                }
            }
            // Use Groq AI for unknown messages
            try {
                const completion = await groq.chat.completions.create({
                    messages: [
                        {
                            role: "system",
                            content: `You are an intelligent assistant for ${config.businessName}, a premium Hostel/PG management service in India. 
                            If users say they have paid (by cash or UPI), guide them to provide the Transaction ID or Amount. 
                            Commands: JOIN (register), RENT (see bills), STATUS (check payment), EB (electricity bill), VACATE (request to leave), HISTORY (upload old payments).
                            Always be warm, professional, and use a helpful Indian service tone. If they mention paying by cash or UPI, you can tell them the bot can record it instantly if they provide the details.`
                        },
                        { role: "user", content: body }
                    ],
                    model: "llama-3.3-70b-versatile",
                });

                const aiResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't understand that. Type HI to see what I can do!";
                await sendMessage(phone, aiResponse);
            } catch (err) {
                console.error('Groq AI Error:', err);
                await sendMessage(phone, "I'm here to help, but having trouble thinking right now. Try a command like RENT or JOIN!");
            }
            break;
    }
}

/**
 * Smart detection for payment messages like "Paid by cash" or "Paid TRX12345"
 */
async function handleSmartPayment(phone, body) {
    logToFile(`Smart Payment Check: ${phone} | ${body}`);
    const clean = body.trim().toUpperCase();
    const contextName = userState[phone]?.contextName;
    const tenant = await sheetsService.getTenantByPhone(phone, contextName);
    if (!tenant) {
        logToFile(`No tenant found for smart payment: ${phone}`);
        return false;
    }

    // Check for "CASH" + "PAID"
    if (clean.includes('PAID') && clean.includes('CASH')) {
        const amountMatch = body.match(/\d{3,}/); // Look for a number like 7000
        if (amountMatch) {
            const amount = amountMatch[0];
            await sheetsService.updateTenant(phone, {
                'Status': 'PAID',
                'Payment Mode': 'CASH',
                'Transaction ID': 'CASH-PMT',
                'Paid Date': new Date().toLocaleDateString()
            }, contextName);

            await sheetsService.logPayment(tenant, amount, 'CASH', 'CASH-PMT');

            await sendMessage(phone, `✅ *Payment Recorded!*\n\nThank you ${tenant.get('Name')}. I have recorded ₹${amount} as cash payment. Your status is now UPDATED. 🙏`);

            if (config.ownerPhone) {
                await sendMessage(config.ownerPhone, `💵 *Cash Payment Confirmed*\n\nTenant: ${tenant.get('Name')}\nAmount: ₹${amount}\nRoom: ${tenant.get('Room')}\nStatus: PAID`);
            }
            return true;
        } else {
            userState[phone] = { step: 'CASH_AMOUNT' };
            await sendMessage(phone, `I see you paid by cash! Please tell me the *Amount* you paid?`);
            return true;
        }
    }

    // Check for "PAID" + Transaction ID (alphanumeric, long)
    if (clean.includes('PAID')) {
        const trxMatch = clean.match(/[A-Z0-9]{10,}/); // Look for something like TRX123456789
        if (trxMatch) {
            const trxId = trxMatch[0];
            await sheetsService.updateTenant(phone, {
                'Status': 'PAID',
                'Payment Mode': 'UPI',
                'Transaction ID': trxId,
                'Paid Date': new Date().toLocaleDateString()
            }, contextName);

            const amountToLog = tenant.get('Total Amount') || '0';
            await sheetsService.logPayment(tenant, amountToLog, 'UPI', trxId);

            await sendMessage(phone, `✅ *UPI Payment Verified!*\n\nThank you for sharing the Transaction ID: *${trxId}*. Your record has been updated successfully! ✨`);

            if (config.ownerPhone) {
                await sendMessage(config.ownerPhone, `💰 *UPI Payment Confirmed*\n\nTenant: ${tenant.get('Name')}\nTRX ID: ${trxId}\nRoom: ${tenant.get('Room')}\nStatus: PAID`);
            }
            return true;
        } else if (clean === 'PAID') {
            return false; // Let the switch handle the basic "PAID" command
        } else {
            // It says "Paid" but no ID, maybe they mean UPI?
            userState[phone] = { step: 'PAYMENT_PROOF' };
            await sendMessage(phone, `Got it! Please share the *Transaction ID* or a screenshot of your payment.`);
            return true;
        }
    }

    return false;
}

async function handleOnboarding(phone, input, image = null) {
    const state = userState[phone];
    logToFile(`Handling Onboarding for ${phone} Step: ${state.step}`);

    switch (state.step) {
        case 'NAME': {
            const validation = await validateInputWithAI('NAME', input);
            if (!validation.isValid) {
                await sendMessage(phone, `❌ ${validation.message || 'Please provide a valid full name.'}`);
                return;
            }
            state.name = input;
            state.step = 'PHONE_NUMBER'; // Internal tracking
            await sendMessage(phone, `Confirm your Phone Number (the one we should track)`);
            break;
        }
        case 'PHONE_NUMBER': {
            const validation = await validateInputWithAI('PHONE_NUMBER', input);
            if (!validation.isValid) {
                await sendMessage(phone, `❌ ${validation.message || 'Please provide a valid phone number.'}`);
                return;
            }
            state.userPhone = input;
            state.step = 'ROOM';
            await sendMessage(phone, `Room Number`);
            break;
        }
        case 'ROOM': {
            const validation = await validateInputWithAI('ROOM', input);
            if (!validation.isValid) {
                await sendMessage(phone, `❌ ${validation.message || 'Please provide a valid room number (e.g., 101, G1).'}`);
                return;
            }
            state.room = input;
            state.step = 'SHARING_TYPE';
            await sendMessage(phone, `Choose Sharing Type (Send number 1-4):\n1. One Sharing (₹9000)\n2. Two Sharing (₹7000)\n3. Three Sharing (₹6500)\n4. Four Sharing (₹6500)`);
            break;
        }
        case 'SHARING_TYPE':
            const sharingMap = {
                '1': { label: 'One Sharing', rent: 9000 },
                '2': { label: 'Two Sharing', rent: 7000 },
                '3': { label: 'Three Sharing', rent: 6500 },
                '4': { label: 'Four Sharing', rent: 6500 }
            };
            if (!sharingMap[input]) {
                await sendMessage(phone, `Invalid choice. Please send 1, 2, 3, or 4.`);
                return;
            }
            state.sharingType = sharingMap[input].label;
            state.monthlyRent = sharingMap[input].rent;
            state.step = 'ADVANCE';
            await sendMessage(phone, `Advance Paid`);
            break;
        case 'ADVANCE': {
            const validation = await validateInputWithAI('ADVANCE', input);
            if (!validation.isValid) {
                await sendMessage(phone, `❌ ${validation.message || 'Please provide a valid advance amount (numbers only).'}`);
                return;
            }
            state.advance = input;
            state.step = 'AADHAAR_UPLOAD';
            await sendMessage(phone, `Please upload a photo of your Aadhaar Card.`);
            break;
        }

        case 'AADHAAR_UPLOAD':
            if (!image) {
                await sendMessage(phone, `Please upload an *image* of your Aadhaar Card.`);
                return;
            }
            state.aadhaarId = image.id;

            // Save media info to MongoDB
            await Media.create({
                phone,
                type: 'AADHAAR',
                mediaId: image.id,
                url: `https://graph.facebook.com/v17.0/${image.id}` // Placeholder for actual download URL if needed
            });

            // Finish registration
            try {
                await sheetsService.addTenant({
                    name: state.name,
                    phone: state.userPhone || phone,
                    room: state.room,
                    advance: state.advance,
                    sharingType: state.sharingType,
                    monthlyRent: state.monthlyRent,
                    aadhaarImage: image.id
                });
                const successImg = path.join(__dirname, '../assets/Payment Banner.png');
                if (fs.existsSync(successImg)) await sendImage(phone, successImg);
                await sendMessage(phone, `✅ Registration successful.\nRoom: ${state.room}\nMonthly Rent: ₹${state.monthlyRent}\nAdvance Paid: ₹${state.advance}\nJoin Date: ${new Date().toLocaleDateString()}\nStatus: ACTIVE\n\nWelcome to StayFlow!`);

                // Notify Owner
                if (config.ownerPhone) {
                    await sendMessage(config.ownerPhone, `🔔 *New Tenant Registered*\n\nName: ${state.name}\nPhone: ${state.userPhone || phone}\nRoom: ${state.room}\nRent: ₹${state.monthlyRent}\nAdvance: ₹${state.advance}\nAadhaar Media ID: ${image.id}`);
                }
            } catch (err) {
                console.error(err);
                await sendMessage(phone, `❌ Registration failed. Please try again later.`);
            }
            delete userState[phone];
            break;

        case 'PAYMENT_PROOF': {
            const contextName = userState[phone]?.contextName;

            if (input && !image) {
                const validation = await validateInputWithAI('TRANS_ID', input);
                if (!validation.isValid) {
                    await sendMessage(phone, `❌ ${validation.message || 'Please provide a valid Transaction ID.'}`);
                    return;
                }
            }

            const updateData = {
                'Status': 'PAID',
                'Payment Mode': 'UPI',
                'Transaction ID': input || (image ? 'IMAGE_UPLOAD' : 'UNKNOWN'),
                'Paid Date': new Date().toLocaleDateString()
            };

            if (image) {
                updateData['Payment Proof'] = image.id;
                await Media.create({
                    phone,
                    type: 'PAYMENT_PROOF',
                    mediaId: image.id
                });
            }

            await sheetsService.updateTenant(phone, updateData, contextName);

            const paidImg = path.join(__dirname, '../assets/Payment Banner.png');
            if (fs.existsSync(paidImg)) await sendImage(phone, paidImg);
            await sendMessage(phone, `✅ Payment Received. Thank you.`);

            // Notify Owner
            const updatedTenant = await sheetsService.getTenantByPhone(phone, contextName);
            if (config.ownerPhone && updatedTenant) {
                await sendMessage(config.ownerPhone, `💰 *Payment Notification*\n\nTenant: ${updatedTenant.get('Name')}\nRoom: ${updatedTenant.get('Room')}\nMode: UPI\nTransaction ID: ${input}\nProof ID: ${image ? image.id : 'None'}\nStatus: PAID`);
            }

            delete userState[phone];
            break;
        }

        case 'HELP_REASON':
            state.reason = input;
            await sendMessage(phone, `Thank you. Your request regarding *${input}* has been forwarded to the owner. We will get back to you soon.`);
            if (config.ownerPhone) {
                await sendMessage(config.ownerPhone, `🆘 *HELP REQUEST*\n\nTenant: ${phone}\nCategory: ${input}\nTime: ${new Date().toLocaleString()}`);
            }
            delete userState[phone];
            break;

        case 'ADVANCE_CHOICE':
            await sendMessage(phone, `Your request for *${input}* of advance has been sent to the owner for approval.`);
            if (config.ownerPhone) {
                await sendMessage(config.ownerPhone, `💰 *ADVANCE REQUEST*\n\nTenant: ${phone}\nAction: ${input}\nPlease approve/adjust in the sheet.`);
            }
            delete userState[phone];
            break;

        case 'CASH_AMOUNT': {
            const validation = await validateInputWithAI('MONEY', input);
            if (!validation.isValid) {
                await sendMessage(phone, `❌ ${validation.message || 'Please provide a valid amount.'}`);
                return;
            }
            state.amount = input;
            state.step = 'CASH_DATE';
            await sendMessage(phone, `Date of payment? (DD/MM/YYYY)`);
            break;
        }

        case 'CASH_DATE': {
            const validation = await validateInputWithAI('DATE', input);
            if (!validation.isValid) {
                await sendMessage(phone, `❌ ${validation.message || 'Please provide a valid date.'}`);
                return;
            }
            const contextName = userState[phone]?.contextName;
            await sheetsService.updateTenant(phone, {
                'Status': 'PAID',
                'Payment Mode': 'CASH',
                'Paid Date': input,
                'Transaction ID': `CASH-${state.amount}`
            }, contextName);
            await sendMessage(phone, `✅ Cash payment of ₹${state.amount} recorded.`);

            // Notify Owner
            const cashTenant = await sheetsService.getTenantByPhone(phone, contextName);
            if (config.ownerPhone && cashTenant) {
                await sendMessage(config.ownerPhone, `💵 *Cash Payment Notification*\n\nTenant: ${cashTenant.get('Name')}\nAmount: ₹${state.amount}\nDate: ${input}\nStatus: PAID`);
            }

            delete userState[phone];
            break;
        }

        case 'ANNOUNCE_MSG': {
            const allTenants = await sheetsService.getAllTenants();
            for (const t of allTenants) {
                if (t.get('Status') === 'ACTIVE' || t.get('Status') === 'PENDING') {
                    await sendMessage(t.get('Phone'), `📢 *ANNOUNCEMENT*\n\n${input}`);
                }
            }
            await sendMessage(phone, `✅ Announcement sent to all active tenants.`);
            delete userState[phone];
            break;
        }

        case 'PREV_PAYMENT_PROOF': {
            if (!image && !input) {
                await sendMessage(phone, `Please upload an old payment screenshot or type the date/amount you paid.`);
                return;
            }

            // Just log it for now or send to owner
            await sendMessage(phone, `✅ Previous payment record received. We have forwarded this to the owner for verification.`);

            if (config.ownerPhone) {
                const proofType = image ? "Screenshot" : "Text Detail";
                const content = image ? `(Media ID: ${image.id})` : input;
                await sendMessage(config.ownerPhone, `📜 *Previous Payment History Submitted*\n\nTenant: ${phone}\nType: ${proofType}\nContent: ${content}\nPlease verify and update records if needed.`);
            }
            delete userState[phone];
            break;
        }
    }
}

async function handleRent(phone) {
    const contextName = userState[phone]?.contextName;
    const tenant = await sheetsService.getTenantByPhone(phone, contextName);
    if (!tenant) return sendMessage(phone, `You are not registered. Type JOIN to start.`);

    const rent = parseFloat(tenant.get('Monthly Rent') || 0);
    const eb = parseFloat(tenant.get('EB Amount') || 0);
    const total = rent + eb;

    const rentBanner = path.join(__dirname, '../assets/Rent.png');
    if (fs.existsSync(rentBanner)) await sendImage(phone, rentBanner);

    const text = `Hi ${tenant.get('Name')},\n\nYour Current Bill:\n\nRent: ₹${rent}\nEB: ₹${eb}\nTotal: ₹${total}`;
    await sendMessage(phone, text);

    if (razorpay && total > 0) {
        try {
            const paymentLink = await razorpay.paymentLink.create({
                amount: total * 100, // Amount in paise
                currency: "INR",
                accept_partial: false,
                description: `Rent & EB for ${tenant.get('Name')} (Room ${tenant.get('Room')})`,
                customer: {
                    name: tenant.get('Name'),
                    contact: phone,
                    email: "tenant@stayflow.com"
                },
                notify: {
                    sms: true,
                    email: true
                },
                reminder_enable: true,
                notes: {
                    room: tenant.get('Room')
                }
            });

            await sendMessage(phone, `👇 *Pay Online Securely via Razorpay:*\n${paymentLink.short_url}\n\n(Click to pay via UPI, Card, or Netbanking)`);
            return;
        } catch (err) {
            console.error('Razorpay Error:', err);
            // Fallback to manual UPI if Razorpay fails
        }
    }

    // Fallback or Standard UPI
    const fallbackText = `Payment Options:\n\n1️⃣ Cash to Owner\n2️⃣ UPI: ${config.upiId}\n\nAfter payment, type PAID and send transaction ID.`;
    await sendMessage(phone, fallbackText);

    // Send owner QR scan image
    const qrPath = path.join(__dirname, '../assets/qr scan.jpeg');
    await sendImage(phone, qrPath);
}

async function handleEB(phone) {
    const contextName = userState[phone]?.contextName;
    const tenant = await sheetsService.getTenantByPhone(phone, contextName);
    if (!tenant) return;

    const ebImg = path.join(__dirname, '../assets/EB Banner.png');
    if (fs.existsSync(ebImg)) await sendImage(phone, ebImg);

    await sendMessage(phone, `Your EB Bill for this month is ₹${tenant.get('EB Amount') || 0}.\nPlease pay before ${config.ebDueDate}th.`);
}

async function handleAdvance(phone) {
    const contextName = userState[phone]?.contextName;
    const tenant = await sheetsService.getTenantByPhone(phone, contextName);
    if (!tenant) return sendMessage(phone, `You are not registered.`);

    const advance = tenant.get('Advance');
    await sendButtons(phone, `Your Advance Balance: ₹${advance}\n\nWhat would you like to do?`, ["ADJUST", "REFUND"]);
    userState[phone] = { step: 'ADVANCE_CHOICE' };
}

async function handleStatus(phone) {
    const contextName = userState[phone]?.contextName;
    const tenant = await sheetsService.getTenantByPhone(phone, contextName);
    if (!tenant) return;

    const rent = tenant.get('Monthly Rent') || 0;
    const eb = tenant.get('EB Amount') || 0;
    const total = parseFloat(rent) + parseFloat(eb);
    const advance = tenant.get('Advance') || 0;
    const room = tenant.get('Room');
    const status = tenant.get('Status');

    const text = `🏠 *Room:* ${room}\n💰 *Advance:* ₹${advance}\n\n*Current Month Status:*\nRent: ₹${rent}\nEB: ₹${eb}\nTotal Due: ₹${total}\nStatus: *${status}*`;

    await sendMessage(phone, text);

    // Show History (Past 3 Months)
    const history = await sheetsService.getHistoryByPhone(phone);
    if (history.length > 0) {
        const historyText = history.slice(-3).map(h => `📅 ${h.get('Month')} ${h.get('Year')}: ₹${h.get('Amount')} (${h.get('Status') || 'PAID'})`).join('\n');
        await sendMessage(phone, `📊 *Recent Payment History:*\n${historyText}`);
    }
}

async function handleAdminTotal(phone) {
    const tenants = await sheetsService.getAllTenants();
    await sendMessage(phone, `TOTAL TENANTS: ${tenants.length}`);
}

async function handleAdminList(phone, status) {
    const tenants = await sheetsService.getAllTenants();
    const list = tenants.filter(t => t.get('Status') === status);
    const text = list.map(t => `- ${t.get('Name')} (${t.get('Room')})`).join('\n') || 'None';
    await sendMessage(phone, `${status} LIST:\n${text}`);
}

async function handleDashboard(phone) {
    const tenants = await sheetsService.getAllTenants();
    const active = tenants.filter(t => t.get('Status') === 'ACTIVE' || t.get('Status') === 'PAID');
    const paid = tenants.filter(t => t.get('Status') === 'PAID');
    const pending = tenants.filter(t => t.get('Status') === 'PENDING' || t.get('Status') === 'ACTIVE');

    let totalRevenue = 0;
    paid.forEach(t => totalRevenue += parseFloat(t.get('Total Amount') || 0));

    const stats = `📊 *STAYFLOW DASHBOARD*\n\nTotal Strength: ${active.length}\nPaid: ${paid.length}\nPending: ${pending.length}\nTotal Revenue: ₹${totalRevenue}\n\nType PAID LIST or PENDING LIST for details.`;
    await sendMessage(phone, stats);
}

async function handleSendBillAll(phone) {
    const tenants = await sheetsService.getAllTenants();

    // Notify Owner
    await sendMessage(phone, `⏳ Sending bills to ${tenants.length} tenants...`);

    for (const t of tenants) {
        if (t.get('Status') !== 'VACATED') {
            const tenantPhone = t.get('Phone');
            const total = t.get('Total Amount') || 0;
            const upiLink = `upi://pay?pa=${config.upiId}&pn=${encodeURIComponent(config.businessName)}&am=${total}&cu=INR`;

            // Short Reminder Message
            const msg = `🔔 *Bill Reminder*\n\nHi ${t.get('Name')},\nTotal Due: *₹${total}*\n\n👇 *Pay Now:*\n${upiLink}`;
            await sendMessage(tenantPhone, msg);
        }
    }
    await sendMessage(phone, "✅ Bills sent to all tenants.");
}

async function handleSendReminder(phone) {
    const tenants = await sheetsService.getAllTenants();
    const pending = tenants.filter(t => t.get('Status') !== 'PAID' && t.get('Status') !== 'VACATED');
    for (const t of pending) {
        await sendMessage(t.get('Phone'), `🔔 *PAYMENT REMINDER*\n\nHi ${t.get('Name')}, this is a friendly reminder to pay your dues.\nTotal: ₹${t.get('Total Amount') || 0}\n\nType RENT for payment options.`);
    }
    await sendMessage(phone, `✅ Reminders sent to ${pending.length} tenants.`);
}

async function handleVacate(phone, room) {
    const allTenants = await sheetsService.getAllTenants();
    const roomTenants = allTenants.filter(t => t.get('Room').toUpperCase() === room.toUpperCase());

    for (const t of roomTenants) {
        await sheetsService.updateTenant(t.get('Phone'), { 'Status': 'VACATED' });
    }

    await sendMessage(phone, `✅ Room ${room} marked as VACATED. All tenants inactive.`);
    // Trigger EB Recalc would go here
}

async function handleMarkCash(phone, tenantPhone) {
    const success = await sheetsService.updateTenant(tenantPhone, {
        'Status': 'PAID',
        'Payment Mode': 'CASH',
        'Paid Date': new Date().toLocaleDateString()
    });
    if (success) {
        await sendMessage(phone, `✅ Marked ${tenantPhone} as PAID by Cash.`);
        await sendMessage(tenantPhone, `✅ Your payment has been recorded as CASH by the owner. Thank you!`);
    } else {
        await sendMessage(phone, `❌ Tenant with phone ${tenantPhone} not found.`);
    }
}

async function handleUpdateEB(phone, roomInput, unitsInput) {
    const units = parseFloat(unitsInput);
    if (isNaN(units)) return sendMessage(phone, "❌ Invalid units. Please send a number.");

    const rate = config.ebUnitRate || 15;
    const totalAmount = units * rate;

    const roomId = roomInput.toUpperCase();
    const allTenants = await sheetsService.getAllTenants();
    const roomTenants = allTenants.filter(t => t.get('Room').toUpperCase() === roomId && t.get('Status') !== 'VACATED');

    if (roomTenants.length === 0) return sendMessage(phone, `❌ No active tenants found in room ${roomId}`);

    const splitAmount = Math.ceil(totalAmount / roomTenants.length);

    for (const tenant of roomTenants) {
        const tenantPhone = tenant.get('Phone');
        const tenantName = tenant.get('Name');
        const rent = parseFloat(tenant.get('Monthly Rent') || 0);
        const total = rent + splitAmount;

        await sheetsService.updateTenant(tenantPhone, {
            'EB Amount': splitAmount.toString(),
            'Total Amount': total.toString()
        });

        // Notify Tenant
        const upiLink = `upi://pay?pa=${config.upiId}&pn=${encodeURIComponent(config.businessName)}&am=${total}&cu=INR`;
        const msg = `⚡ *Electricity Bill Updated*\n\nHi ${tenantName},\nEB for Room ${roomId} has been calculated:\n\nRent: ₹${rent}\nEB (Split): ₹${splitAmount}\n*Total: ₹${total}*\n\n👇 *Pay via UPI:*\n${upiLink}\n\nType *PAID* after payment.`;
        await sendMessage(tenantPhone, msg);
    }

    await sendMessage(phone, `✅ *EB Updated for Room ${roomId}*\n\nTotal Room bill: ₹${totalAmount}\nSplit per head (${roomTenants.length}): ₹${splitAmount}\n\nTenants updated: ${roomTenants.map(t => t.get('Name')).join(', ')}`);
}

async function handleTenantVacateRequest(phone) {
    const contextName = userState[phone]?.contextName;
    const tenant = await sheetsService.getTenantByPhone(phone, contextName);
    if (!tenant) return sendMessage(phone, "You are not registered.");

    const name = tenant.get('Name');
    const room = tenant.get('Room');

    await sendMessage(phone, `We have received your request to vacate Room ${room}. The owner has been notified and will contact you shortly regarding the settlement and advance refund. 🙏`);

    if (config.ownerPhone) {
        await sendMessage(config.ownerPhone, `🏃 *VACATE REQUEST*\n\nResident: ${name}\nPhone: ${phone}\nRoom: ${room}\nAction Required: Please check documentation and settle advance.`);
    }
}

module.exports = {
    handleIncomingMessage,
    sendMessage,
    sendImage,
    setTenantContext,
    handleUpdateEB,
    handleVacate,
    handleMarkCash,
    handleSendBillAll,
    createRazorpayLink
};
