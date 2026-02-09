import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import Groq from 'groq-sdk';
import Razorpay from 'razorpay';
import { fileURLToPath } from 'url';
import config from './config.js';
import sheetsService from './sheets.js';
import { Log, Media } from './db.js';
// We'll use dynamic import for wweb to avoid circular dependency issues at top level
// import wweb from './wweb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    const { default: wweb } = await import('./wweb.js');
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
        const { default: wweb } = await import('./wweb.js');
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

    const isPaymentAction = await handleSmartPayment(phone, body);
    if (isPaymentAction) return;

    switch (cleanBody) {
        case config.commands.JOIN:
            const joinBanner = path.join(__dirname, '../assets/JOIN.png');
            if (fs.existsSync(joinBanner)) await sendImage(phone, joinBanner);
            const formUrl = config.googleFormUrl || 'https://forms.gle/YOUR_FORM_ID';
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
                const now = new Date();
                const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                const currentMonth = monthNames[now.getMonth()];
                const dueDate = `${config.rentDueDate}th ${currentMonth}`;
                const statusEmoji = status === 'PAID' ? '✅' : (status === 'PENDING' ? '⏳' : '🔔');
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
                const dashboardMsg = `━━━━━━━━━━━━━━━━━━━━━\n🏠 *${config.businessName} Portal*\n━━━━━━━━━━━━━━━━━━━━━\n\nWelcome back, *${name}*! 👋\n\n📍 *Your Details:*\n🚪 Room: ${room}\n📌 Location: ${location}\n${statusEmoji} Status: *${status}*\n\n💰 *Upcoming Bill - ${currentMonth}:*\n┌─────────────────────\n│ 🏠 Rent: ₹${rent}\n│ ⚡ EB: ₹${eb}\n└─────────────────────\n💵 *Total Due: ₹${total}*\n📅 *Due Date: ${dueDate}*${historyText}\n\n━━━━━━━━━━━━━━━━━━━━━\n⚡ *Quick Actions:*\n━━━━━━━━━━━━━━━━━━━━━\n📋 Type *RENT* - View bill & pay\n📜 Type *HISTORY* - Full payment history\n🚪 Type *VACATE* - Request to leave\n🆘 Type *HELP* - Raise complaint\n\n_Reply with any option above_`;
                await sendMessage(phone, dashboardMsg);
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

async function handleSmartPayment(phone, body) {
    const clean = body.trim().toUpperCase();
    const contextName = userState[phone]?.contextName;
    const tenant = await sheetsService.getTenantByPhone(phone, contextName);
    if (!tenant) return false;
    if (clean.includes('PAID') && clean.includes('CASH')) {
        const amountMatch = body.match(/\d{3,}/);
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
    if (clean.includes('PAID')) {
        const trxMatch = clean.match(/[A-Z0-9]{10,}/);
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
            return false;
        } else {
            userState[phone] = { step: 'PAYMENT_PROOF' };
            await sendMessage(phone, `Got it! Please share the *Transaction ID* or a screenshot of your payment.`);
            return true;
        }
    }
    return false;
}

// NOTE: The rest of the functions (handleRent, handleEB, handleStatus, handleOnboarding, etc.) 
// should be exported or defined here. For brevity, I'll export the main ones.

async function handleRent(phone) {
    const tenant = await sheetsService.getTenantByPhone(phone, userState[phone]?.contextName);
    if (!tenant) {
        await sendMessage(phone, "Please JOIN first.");
        return;
    }
    const name = tenant.get('Name');
    const rent = tenant.get('Monthly Rent');
    const eb = tenant.get('EB Amount') || '0';
    const total = parseFloat(rent) + parseFloat(eb);
    const upiLink = `upi://pay?pa=${config.upiId}&pn=${encodeURIComponent(config.businessName)}&am=${total}&cu=INR`;
    const razorpayLink = await createRazorpayLink(phone, name, total, tenant.get('Room'));
    let msg = `💰 *Rent Details*\n\nName: ${name}\nRent: ₹${rent}\nEB: ₹${eb}\n*Total Due: ₹${total}*\n\n👇 *Pay via UPI:*\n${upiLink}`;
    if (razorpayLink) msg += `\n\n💳 *Pay Online:* ${razorpayLink}`;
    await sendMessage(phone, msg);
}

async function handleEB(phone) {
    const tenant = await sheetsService.getTenantByPhone(phone, userState[phone]?.contextName);
    if (!tenant) return;
    const eb = tenant.get('EB Amount') || '0';
    await sendMessage(phone, `⚡ Your Electricity Bill for this month is *₹${eb}*. This is included in your total rent.`);
}

async function handleStatus(phone) {
    const tenant = await sheetsService.getTenantByPhone(phone, userState[phone]?.contextName);
    if (!tenant) return;
    const status = tenant.get('Status');
    const emoji = status === 'PAID' ? '✅' : '⏳';
    await sendMessage(phone, `${emoji} Your current payment status is: *${status}*`);
}

async function handleAdvance(phone) {
    const tenant = await sheetsService.getTenantByPhone(phone, userState[phone]?.contextName);
    if (!tenant) return;
    const advance = tenant.get('Advance');
    await sendMessage(phone, `💰 You have an advance of *₹${advance}* with us.`);
}

async function handleTenantVacateRequest(phone) {
    const tenant = await sheetsService.getTenantByPhone(phone, userState[phone]?.contextName);
    if (!tenant) return;
    await sendMessage(phone, `We are sorry to see you go! 😔\nYour request to vacate Room *${tenant.get('Room')}* has been sent to the admin. We will process it shortly.`);
    if (config.ownerPhone) {
        await sendMessage(config.ownerPhone, `🚪 *VACATE REQUEST*\n\nTenant: ${tenant.get('Name')}\nRoom: ${tenant.get('Room')}\nPhone: ${phone}\nPlease confirm after clearing dues.`);
    }
}

async function handleUpdateEB(ownerPhone, room, units) {
    const tenants = await sheetsService.getAllTenants();
    const roomTenants = tenants.filter(t => t.get('Room') === room && t.get('Status') !== 'VACATED');
    if (roomTenants.length === 0) {
        await sendMessage(ownerPhone, `No active tenants found in room ${room}.`);
        return;
    }
    const perPersonEB = Math.round((units * config.ebUnitRate) / roomTenants.length);
    for (const t of roomTenants) {
        const rent = parseFloat(t.get('Monthly Rent') || 0);
        await sheetsService.updateTenant(t.get('Phone'), {
            'EB Amount': perPersonEB.toString(),
            'Total Amount': (rent + perPersonEB).toString(),
            'Status': 'PENDING'
        }, t.get('Name'));
        await sendMessage(t.get('Phone'), `⚡ *EB Update*\nRoom ${room} used ${units} units. Your share: *₹${perPersonEB}*.\nTotal due: *₹${rent + perPersonEB}*.\nType RENT to pay.`);
    }
    await sendMessage(ownerPhone, `Updated EB for ${roomTenants.length} tenants in room ${room}. Each: ₹${perPersonEB}`);
}

async function handleVacate(ownerPhone, room) {
    const tenants = await sheetsService.getAllTenants();
    const roomTenants = tenants.filter(t => t.get('Room') === room && t.get('Status') !== 'VACATED');
    for (const t of roomTenants) {
        await sheetsService.updateTenant(t.get('Phone'), { 'Status': 'VACATED' }, t.get('Name'));
        await sendMessage(t.get('Phone'), `🚪 Your checkout from Room ${room} is confirmed. Thank you for staying with us!`);
    }
    await sendMessage(ownerPhone, `Marked ${roomTenants.length} residents in room ${room} as VACATED.`);
}

async function handleMarkCash(ownerPhone, tenantPhone) {
    const success = await sheetsService.updateTenant(tenantPhone, { 'Status': 'PAID', 'Payment Mode': 'CASH', 'Paid Date': new Date().toLocaleDateString() });
    if (success) {
        await sendMessage(tenantPhone, `✅ Your cash payment has been confirmed by the admin. Thank you!`);
        await sendMessage(ownerPhone, `Marked ${tenantPhone} as PAID (Cash).`);
    } else {
        await sendMessage(ownerPhone, `Tenant ${tenantPhone} not found.`);
    }
}

async function handleAdminTotal(ownerPhone) {
    const tenants = await sheetsService.getAllTenants();
    const active = tenants.filter(t => t.get('Status') !== 'VACATED');
    const paid = active.filter(t => t.get('Status') === 'PAID').length;
    await sendMessage(ownerPhone, `📊 *Tenant Stats*\nTotal Active: ${active.length}\nPaid: ${paid}\nPending: ${active.length - paid}`);
}

async function handleAdminList(ownerPhone, status) {
    const tenants = await sheetsService.getAllTenants();
    const list = tenants.filter(t => t.get('Status') === status);
    if (list.length === 0) {
        await sendMessage(ownerPhone, `No tenants with status: ${status}`);
        return;
    }
    let msg = `📋 *${status} List:*\n`;
    list.forEach(t => msg += `- ${t.get('Name')} (${t.get('Room')}): ${t.get('Phone')}\n`);
    await sendMessage(ownerPhone, msg);
}

async function handleDashboard(ownerPhone) {
    const stats = await sheetsService.getDashboardStats();
    const msg = `📊 *StayFlow Admin Dashboard*\n\nResidents: ${stats.totalTenants}\n✅ Paid: ${stats.paidCount}\n⏳ Pending: ${stats.pendingCount}\n💰 Revenue: ₹${stats.totalRevenue}\n📈 Collection: ${stats.collectionPercentage}%`;
    await sendMessage(ownerPhone, msg);
}

async function handleSendBillAll(ownerPhone) {
    await sendMessage(ownerPhone, `Generating and sending invoices to all pending residents...`);
    const tenants = await sheetsService.getAllTenants();
    const pending = tenants.filter(t => t.get('Status') === 'PENDING' || t.get('Status') === 'ACTIVE');
    for (const t of pending) {
        await handleIncomingMessage(t.get('Phone'), 'RENT');
        await new Promise(r => setTimeout(r, 2000));
    }
    await sendMessage(ownerPhone, `Sent billing info to ${pending.length} residents.`);
}

async function handleSendReminder(ownerPhone) {
    const tenants = await sheetsService.getAllTenants();
    const pending = tenants.filter(t => t.get('Status') !== 'PAID' && t.get('Status') !== 'VACATED');
    for (const t of pending) {
        await sendMessage(t.get('Phone'), `🔔 *Payment Reminder*\nFriendly reminder to pay your dues. Type RENT to see details.`);
        await new Promise(r => setTimeout(r, 1000));
    }
    await sendMessage(ownerPhone, `Sent reminders to ${pending.length} residents.`);
}

async function handleOnboarding(phone, input, image) {
    const state = userState[phone];
    switch (state.step) {
        case 'NAME': {
            const val = await validateInputWithAI('NAME', input);
            if (!val.isValid) { await sendMessage(phone, `❌ ${val.message}`); return; }
            state.name = input; state.step = 'PHONE_NUMBER';
            await sendMessage(phone, `Confirm your Phone Number`);
            break;
        }
        case 'PHONE_NUMBER': {
            const val = await validateInputWithAI('PHONE_NUMBER', input);
            if (!val.isValid) { await sendMessage(phone, `❌ ${val.message}`); return; }
            state.userPhone = input; state.step = 'ROOM';
            await sendMessage(phone, `Room Number`);
            break;
        }
        case 'ROOM': {
            const val = await validateInputWithAI('ROOM', input);
            if (!val.isValid) { await sendMessage(phone, `❌ ${val.message}`); return; }
            state.room = input; state.step = 'SHARING_TYPE';
            await sendMessage(phone, `Choose Sharing Type:\n1. One (9000)\n2. Two (7000)\n3. Three (6500)\n4. Four (6500)`);
            break;
        }
        case 'SHARING_TYPE':
            const m = { '1': 9000, '2': 7000, '3': 6500, '4': 6500 };
            if (!m[input]) { await sendMessage(phone, `Invalid choice.`); return; }
            state.monthlyRent = m[input]; state.sharingType = input + ' Sharing'; state.step = 'ADVANCE';
            await sendMessage(phone, `Advance Paid`);
            break;
        case 'ADVANCE':
            state.advance = input; state.step = 'AADHAAR_UPLOAD';
            await sendMessage(phone, `Please upload Aadhaar image.`);
            break;
        case 'AADHAAR_UPLOAD':
            if (!image) { await sendMessage(phone, `Please upload an *image*.`); return; }
            await sheetsService.addTenant({
                name: state.name, phone: state.userPhone || phone, room: state.room,
                advance: state.advance, sharingType: state.sharingType, monthlyRent: state.monthlyRent,
                aadhaarImage: image.id
            });
            await sendMessage(phone, `✅ Registered!`);
            delete userState[phone];
            break;
    }
}

export {
    handleIncomingMessage,
    sendMessage,
    sendImage,
    createRazorpayLink,
    setTenantContext,
    handleUpdateEB
};
