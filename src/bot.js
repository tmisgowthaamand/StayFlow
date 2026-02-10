import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Razorpay from 'razorpay';
import { fileURLToPath } from 'url';
import config from './config.js';
import sheetsService from './sheets.js';
import pdfService from './pdfService.js';
import { Log, Media } from './db.js';
// We'll use dynamic import for wweb to avoid circular dependency issues at top level
// import wweb from './wweb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Google Gemini AI
let geminiModel = null;
if (config.geminiApiKey) {
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    console.log('✅ Google Gemini AI initialized');
} else {
    console.warn('⚠️ GEMINI_API_KEY not set - AI chat will be disabled');
}

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
        // WhatsApp redirect URL - after payment, user returns to WhatsApp chat
        // We use the same phone number they came from to send them back to the chat
        const botNumber = config.ownerPhone || '919876543210'; // Fallback if bot number not set
        const whatsappRedirect = `https://wa.me/${botNumber}?text=PAID%20BY%20UPI`;

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
            callback_url: whatsappRedirect,
            callback_method: 'get',
            notes: {
                room: room,
                phone: phone,
                tenant_name: name
            }
        });
        return paymentLink.short_url;
    } catch (err) {
        console.error('Razorpay Link Generation Failed:', err.message);
        return null;
    }
}

async function validateInputWithAI(step, input) {
    if (!geminiModel) return { isValid: true };

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
        const result = await geminiModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompts[step] }] }],
            generationConfig: { responseMimeType: 'application/json' }
        });
        return JSON.parse(result.response.text());
    } catch (err) {
        console.error('Gemini Validation Error:', err.message);
        return { isValid: true };
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
    // If it's already 12 digits starting with 91, return as is
    // If it's somehow more (with 0 or +), the replace(/\D/g) and length check should handle most cases
    return clean;
}

async function sendMessage(to, text) {
    const { default: wweb } = await import('./wweb.js');

    // 1. Try WWeb first (bypasses 24-hour window)
    if (wweb.ready) {
        try {
            await wweb.sendMessage(to, text);
            console.log(`[WWeb] Message sent to ${to}`);
            return;
        } catch (wwebErr) {
            console.error('[WWeb] Failed, trying Cloud API:', wwebErr.message);
        }
    }

    const cleanTo = normalizePhone(to);
    try {
        // 2. Try regular Cloud API message
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
        const errorCode = err.response?.data?.error?.code;

        // 3. If 24-hour window error, try template message
        if (errorCode === 131047) {
            console.log(`[Cloud API] 24h window expired for ${cleanTo}. Sending template...`);
            try {
                await axios.post(
                    `https://graph.facebook.com/v17.0/${config.whatsapp.phoneNumberId}/messages`,
                    {
                        messaging_product: "whatsapp",
                        to: cleanTo,
                        type: "template",
                        template: {
                            name: "hello_world",  // Default Meta template
                            language: { code: "en_US" }
                        }
                    },
                    { headers: { Authorization: `Bearer ${config.whatsapp.token}` } }
                );
                console.log(`[Template] Fallback sent to ${cleanTo}`);
            } catch (templateErr) {
                console.error(`[Template] Also failed:`, templateErr.response?.data || templateErr.message);
            }
        } else {
            logToFile(`Error sending message to ${cleanTo}: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
        }
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

async function sendMedia(to, filePath, caption = "", buttons = null, displayFilename = null) {
    try {
        const { default: wweb } = await import('./wweb.js');
        const cleanTo = normalizePhone(to);
        const extension = path.extname(filePath).toLowerCase();

        let type = 'document';
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) type = 'image';
        else if (['.mp4', '.avi', '.mov', '.3gp'].includes(extension)) type = 'video';
        else if (['.mp3', '.ogg', '.wav', '.aac', '.opus', '.amr'].includes(extension)) type = 'audio';
        else if (['.pdf'].includes(extension)) type = 'document';

        // 1. Try WWeb first
        if (wweb.ready) {
            try {
                await wweb.sendImage(to, filePath, caption);
                if (buttons && buttons.length > 0) {
                    // WWeb doesn't support buttons on media easily, send as next message
                    await sendButtons(to, "Please choose payment method:", buttons);
                }
                return;
            } catch (wwebErr) {
                console.error('WWeb sendMedia failed, falling back to Cloud API:', wwebErr.message);
            }
        }

        // 2. Try Cloud API Fallback
        const mediaId = await uploadMedia(filePath);
        if (!mediaId) return;

        let payload;
        if (buttons && buttons.length > 0 && (type === 'image' || type === 'video' || type === 'document')) {
            // Interactive Media Message (One bubble)
            payload = {
                messaging_product: "whatsapp",
                to: cleanTo,
                type: "interactive",
                interactive: {
                    type: "button",
                    header: {
                        type: type,
                        [type]: { id: mediaId, filename: displayFilename || (type === 'document' ? path.basename(filePath) : undefined) }
                    },
                    body: { text: caption || "Please see the attached file." },
                    action: {
                        buttons: buttons.map((btn, i) => ({
                            type: "reply",
                            reply: { id: `btn_${i}`, title: btn }
                        }))
                    }
                }
            };
        } else {
            // Standard Media Message
            payload = {
                messaging_product: "whatsapp",
                to: cleanTo,
                type: type,
                [type]: {
                    id: mediaId,
                    caption: type !== 'audio' ? caption : undefined,
                    filename: displayFilename || (type === 'document' ? path.basename(filePath) : undefined)
                },
            };
        }

        await axios.post(
            `https://graph.facebook.com/v17.0/${config.whatsapp.phoneNumberId}/messages`,
            payload,
            { headers: { Authorization: `Bearer ${config.whatsapp.token}` } }
        );
    } catch (err) {
        console.error('sendMedia fully failed:', err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

// Alias for sendMedia specifically for images
async function sendImage(to, filePath, caption = "") {
    return sendMedia(to, filePath, caption);
}

// Helper function to detect MIME type from file magic bytes
function detectMimeTypeFromBuffer(buffer) {
    // Check magic bytes for common file types
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return 'image/jpeg';
    }
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        return 'image/png';
    }
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        return 'image/webp';
    }
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        return 'application/pdf';
    }
    // MP4 (ftyp box)
    if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
        return 'video/mp4';
    }
    // MP3 with ID3 header
    if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
        return 'audio/mpeg';
    }
    // MP3 with sync word
    if (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) {
        return 'audio/mpeg';
    }
    // OGG
    if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
        return 'audio/ogg';
    }
    // AAC (ADTS header)
    if (buffer[0] === 0xFF && (buffer[1] & 0xF6) === 0xF0) {
        return 'audio/aac';
    }
    // GIF
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
        return 'image/gif'; // Note: WhatsApp doesn't support GIF directly, but we detect it
    }
    return null;
}

async function uploadMedia(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            console.error('File not found:', filePath);
            return null;
        }

        const extension = path.extname(filePath).toLowerCase();
        const filename = path.basename(filePath);

        // Map extensions to MIME types (WhatsApp supported types)
        const mimeTypes = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.txt': 'text/plain',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.mp4': 'video/mp4',
            '.3gp': 'video/3gpp',
            '.mp3': 'audio/mpeg',
            '.aac': 'audio/aac',
            '.ogg': 'audio/ogg',
            '.opus': 'audio/opus',
            '.amr': 'audio/amr'
        };

        let mimeType = mimeTypes[extension];

        // If no extension or unknown extension, detect from file magic bytes
        if (!mimeType || mimeType === 'application/octet-stream') {
            try {
                const fileBuffer = fs.readFileSync(filePath);
                const detectedMime = detectMimeTypeFromBuffer(fileBuffer);
                if (detectedMime) {
                    mimeType = detectedMime;
                    console.log(`Detected MIME type from file content: ${mimeType}`);
                } else {
                    // Default to image/jpeg for unknown image-like files (common case for uploads)
                    mimeType = 'image/jpeg';
                    console.warn(`Could not detect file type, defaulting to: ${mimeType}`);
                }
            } catch (readErr) {
                console.error('Error reading file for MIME detection:', readErr.message);
                mimeType = 'image/jpeg'; // Safe default
            }
        }

        // Generate a proper filename with extension if missing
        let uploadFilename = filename;
        if (!extension || extension === '') {
            const extMap = {
                'image/jpeg': '.jpg',
                'image/png': '.png',
                'image/webp': '.webp',
                'application/pdf': '.pdf',
                'video/mp4': '.mp4',
                'audio/mpeg': '.mp3',
                'audio/ogg': '.ogg',
                'audio/aac': '.aac'
            };
            uploadFilename = filename + (extMap[mimeType] || '.jpg');
        }

        const data = new FormData();
        data.append('messaging_product', 'whatsapp');
        // Pass the file with correct options including contentType and filename
        data.append('file', fs.createReadStream(filePath), {
            filename: uploadFilename,
            contentType: mimeType
        });
        data.append('type', mimeType);

        console.log(`Uploading media: ${uploadFilename} (${mimeType})`);

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

        console.log(`Media uploaded successfully, ID: ${response.data.id}`);
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
        case 'RULES': {
            const rulesMsg = `🏢 *PG House Rules & Regulations*\n━━━━━━━━━━━━━━━━━━━━\n⚖️ *DO's:*\n1. Keep your room and shared areas clean and hygienic.\n2. Maintain silence after 10:00 PM for everyone's comfort.\n3. Pay rent by the 5th and EB bills by the 10th of each month.\n4. Inform the admin 30 days before vacating.\n5. Cooperate with police verification and security checks.\n\n🚫 *DON'Ts:*\n1. Strictly NO smoking, alcohol, or illegal substances.\n2. No overnight visitors allowed without prior permission.\n3. Do not use heavy appliances (Heaters/AC/Iron) without approval.\n4. No loud music, parties, or disturbances in rooms.\n5. Do not damage PG property or furniture.\n\n📜 *Note:* Rules are for the safety and comfort of all residents. Violations may lead to penalties or eviction.\n━━━━━━━━━━━━━━━━━━━━`;
            await sendMessage(phone, rulesMsg);
            break;
        }
        case config.commands.RENT:
            await handleRent(phone);
            break;
        case config.commands.EB:
            await handleEB(phone);
            break;
        case config.commands.STATUS:
            await handleStatus(phone);
            break;
        case config.commands.PAID: {
            const tenantForPaid = await sheetsService.getTenantByPhone(phone);
            if (!tenantForPaid || tenantForPaid.get('Status') === 'VACATED') {
                await sendMessage(phone, "You're not registered. Type *JOIN* to start.");
                break;
            }
            const paidRent = parseFloat(tenantForPaid.get('Monthly Rent') || 0);
            const paidEB = parseFloat(tenantForPaid.get('EB Amount') || 0);
            const paidTotal = paidRent + paidEB;
            userState[phone] = { step: 'PAYMENT_METHOD', contextName: tenantForPaid.get('Name') };

            const msg = `💳 *Select payment method:*\n\n1️⃣ *UPI/APP* (Get PDF Invoice)\n2️⃣ *Cash* (Type Rent & EB total)\n\n🏠 Rent: ₹${paidRent}\n⚡ EB: ₹${paidEB}\n━━━━━━━━━━━━━━━━━━━━\n💵 *Total Due: ₹${paidTotal}*`;
            await sendButtons(phone, msg, ["1. UPI/APP", "2. Cash", "Cancel"]);
            break;
        }
        case config.commands.CASH_PAID: {
            const tenantForCash = await sheetsService.getTenantByPhone(phone);
            if (!tenantForCash || tenantForCash.get('Status') === 'VACATED') {
                await sendMessage(phone, "You're not registered. Type *JOIN* to start.");
                break;
            }
            const cashRent = parseFloat(tenantForCash.get('Monthly Rent') || 0);
            const cashEB = parseFloat(tenantForCash.get('EB Amount') || 0);
            const cashTotal = cashRent + cashEB;
            userState[phone] = { step: 'CASH_AMOUNT', contextName: tenantForCash.get('Name'), expectedTotal: cashTotal };
            await sendMessage(phone, `💵 *Cash Payment*\n\n🏠 Rent: ₹${cashRent}\n⚡ EB: ₹${cashEB}\n💰 *Total Due: ₹${cashTotal}*\n\nPlease enter the *amount paid*.\nExample: *${cashTotal}*`);
            break;
        }
        case config.commands.HELP:
            await sendButtons(phone, `🆘 *Need Help?*\n\nPlease select your issue category:`, ["🔧 Maintenance", "💰 Payment", "📋 Other"]);
            userState[phone] = { step: 'HELP_CATEGORY' };
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

            // Smart keyword matching before AI
            await handleSmartChat(phone, body, cleanBody);
            break;
    }
}

// ==================== SMART AI CHAT ====================
async function handleSmartChat(phone, body, cleanBody) {
    const tenant = await sheetsService.getTenantByPhone(phone);

    // --- Keyword matching for common queries ---
    const billKeywords = ['BILL', 'DUE', 'HOW MUCH', 'KITNA', 'AMOUNT', 'TOTAL', 'PENDING AMOUNT'];
    const ebKeywords = ['EB', 'ELECTRICITY', 'CURRENT BILL', 'LIGHT BILL', 'POWER'];
    const historyKeywords = ['HISTORY', 'PREVIOUS', 'LAST PAYMENT', 'OLD PAYMENT', 'PAST'];
    const receiptKeywords = ['RECEIPT', 'INVOICE', 'PDF', 'BILL COPY'];
    const payKeywords = ['PAY', 'PAYMENT', 'UPI', 'CASH', 'TRANSFER', 'GPAY', 'PHONEPE', 'PAYTM'];
    const statusKeywords = ['STATUS', 'PAID OR NOT', 'CHECK', 'CONFIRM'];

    if (tenant && tenant.get('Status') !== 'VACATED') {
        const name = tenant.get('Name');
        const rent = parseFloat(tenant.get('Monthly Rent') || 0);
        const eb = parseFloat(tenant.get('EB Amount') || 0);
        const total = rent + eb;
        const status = tenant.get('Status') || 'PENDING';
        const room = tenant.get('Room') || 'N/A';

        // Bill query
        if (billKeywords.some(k => cleanBody.includes(k))) {
            let msg = `💰 *Your Current Bill*\n\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n━━━━━━━━━━━━━━━━━━━━\n💵 *Total: ₹${total}*\n\n📊 Status: ${status === 'PAID' ? '✅ PAID' : '⏳ PENDING'}`;

            // Add previous bill history
            try {
                const history = await sheetsService.getPaymentHistory(phone, 3);
                if (history && history.length > 0) {
                    msg += `\n\n📜 *Previous Bills:*`;
                    history.forEach(h => {
                        const monthYear = h.get('Month-Year') || 'Unknown';
                        const amt = h.get('Total Amount') || '0';
                        const pStatus = h.get('Status') || 'PAID';
                        msg += `\n${pStatus === 'PAID' ? '✅' : '⏳'} ${monthYear}: ₹${amt}`;
                    });
                }
            } catch (e) { }

            if (status !== 'PAID') {
                msg += `\n\n👉 Type *PAID* to record your payment`;
            }
            await sendMessage(phone, msg);
            return;
        }

        // EB query
        if (ebKeywords.some(k => cleanBody.includes(k)) && !cleanBody.includes('SET')) {
            await sendMessage(phone, `⚡ *Electricity Bill*\n\nRoom: ${room}\nEB Amount: ₹${eb}\nRate: ₹${config.ebUnitRate}/unit\n\nThis is added to your monthly rent of ₹${rent}.\n💵 *Total Due: ₹${total}*`);
            return;
        }

        // History query
        if (historyKeywords.some(k => cleanBody.includes(k))) {
            try {
                const paymentHistory = await sheetsService.getPaymentHistory(phone, 6);
                let historyMsg = `📜 *Payment History - ${name}*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
                if (paymentHistory && paymentHistory.length > 0) {
                    paymentHistory.forEach(h => {
                        const monthYear = h.get('Month-Year') || 'Unknown';
                        const amount = h.get('Total Amount') || '0';
                        const mode = h.get('Payment Mode') || 'N/A';
                        const pStatus = h.get('Status') || 'PAID';
                        historyMsg += `${pStatus === 'PAID' ? '✅' : '⏳'} *${monthYear}*\n   Amount: ₹${amount} | Mode: ${mode}\n\n`;
                    });
                } else {
                    historyMsg += `No payment history found yet.\n\n`;
                }
                historyMsg += `━━━━━━━━━━━━━━━━━━━━`;
                await sendMessage(phone, historyMsg);
            } catch (err) {
                await sendMessage(phone, `Unable to fetch history right now. Please try again.`);
            }
            return;
        }

        // Receipt / Invoice query
        if (receiptKeywords.some(k => cleanBody.includes(k))) {
            if (status === 'PAID') {
                const trxId = tenant.get('Transaction ID') || 'N/A';
                const paidDate = tenant.get('Paid Date') || new Date().toLocaleDateString();
                const mode = tenant.get('Payment Mode') || 'N/A';
                const { filePath } = await pdfService.generateInvoice({
                    Name: name, Phone: tenant.get('Phone'), Room: room,
                    EB_Amount: eb.toString(), Monthly_Rent: rent.toString(), Total_Amount: total.toString(),
                    Paid_Date: paidDate, Transaction_ID: trxId, Payment_Mode: mode
                });
                await sendMessage(phone, `📄 Here's your latest payment receipt:`);
                await sendMedia(phone, filePath, `Receipt - ${name}`);
            } else {
                await sendMessage(phone, `⏳ No payment recorded yet for this month.\n\nOnce you pay, type *PAID* and I'll generate your receipt instantly! 🧾`);
            }
            return;
        }

        // Pay query
        if (payKeywords.some(k => cleanBody.includes(k))) {
            if (status === 'PAID') {
                await sendMessage(phone, `✅ You've already paid for this month! 🎉\n\nTotal Paid: ₹${total}\nMode: ${tenant.get('Payment Mode') || 'N/A'}\n\nType *RECEIPT* to get your invoice.`);
            } else {
                userState[phone] = { step: 'PAYMENT_METHOD', contextName: name };
                await sendMessage(phone, `💰 *Payment - ${name}*\n\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n━━━━━━━━━━━━━━━━━━━━\n💵 *Total Due: ₹${total}*\n\n*How will you pay?*\n\n1️⃣ *UPI* - Online/UPI/Razorpay\n2️⃣ *CASH* - Paid by cash\n\nReply *1* or *2*`);
            }
            return;
        }

        // Status query
        if (statusKeywords.some(k => cleanBody.includes(k))) {
            const statusEmoji = status === 'PAID' ? '✅' : '⏳';
            await sendMessage(phone, `${statusEmoji} *Payment Status*\n\nName: ${name}\nRoom: ${room}\nStatus: *${status}*\n\n${status === 'PAID' ? 'Your payment is confirmed! Type *RECEIPT* for invoice.' : 'Payment pending. Type *PAID* to record your payment.'}`);
            return;
        }
    }

    // --- Gemini AI for natural conversation ---
    await handleGeminiChat(phone, body, tenant);
}

async function handleGeminiChat(phone, body, tenant) {
    if (!geminiModel) {
        await sendMessage(phone, `I'm sorry, I couldn't understand that. 😅\n\nHere's what I can do:\n\n📋 Type *HI* - See your dashboard\n💰 Type *RENT* - View your bill\n✅ Type *PAID* - Record payment\n📜 Type *HISTORY* - Payment history\n🆘 Type *HELP* - Raise a complaint\n🚪 Type *VACATE* - Request to leave`);
        return;
    }

    try {
        // Build tenant context for AI
        let tenantContext = 'The user is NOT registered as a tenant.';
        if (tenant && tenant.get('Status') !== 'VACATED') {
            const rent = parseFloat(tenant.get('Monthly Rent') || 0);
            const eb = parseFloat(tenant.get('EB Amount') || 0);
            const total = rent + eb;
            tenantContext = `TENANT INFO:\n- Name: ${tenant.get('Name')}\n- Room: ${tenant.get('Room')}\n- Rent: ₹${rent}\n- EB: ₹${eb}\n- Total Due: ₹${total}\n- Status: ${tenant.get('Status') || 'PENDING'}\n- Location: ${tenant.get('Location') || 'Main Branch'}`;
        }

        const systemPrompt = `You are a friendly, warm AI assistant for "${config.businessName}" - a premium PG/Hostel in India.

RULES:
1. Keep responses short (2-4 lines max unless showing data)
2. Be friendly, use simple English with occasional Hindi words like "ji", "bhai", "no worries"
3. Use emojis naturally but not excessively
4. NEVER make up bill amounts - only use the TENANT INFO provided below
5. If they ask about bills/payment/rent, tell them to type the specific command
6. If they seem confused, guide them to type HI to see all options
7. If they are not registered, guide them to type JOIN
8. Don't generate long paragraphs. Be concise and helpful.
9. If they say thanks or bye, respond warmly
10. If they ask who you are, say you're the StayFlow AI assistant

AVAILABLE COMMANDS to suggest:
- HI → Dashboard with all details
- RENT → View bill & pay
- PAID → Record payment (UPI/Cash)
- HISTORY → Past payments
- RECEIPT → Get invoice PDF
- EB → Electricity bill
- STATUS → Payment status
- HELP → Raise complaint
- VACATE → Leave request
- JOIN → Register

${tenantContext}`;

        const result = await geminiModel.generateContent([
            { text: systemPrompt },
            { text: `User message: ${body}` }
        ]);

        const aiResponse = result.response.text() || "I didn't catch that! Type *HI* to see what I can do 😊";
        await sendMessage(phone, aiResponse);
    } catch (err) {
        console.error('Gemini AI Error:', err.message);
        await sendMessage(phone, `I'm here to help! 😊\n\nTry these commands:\n📋 *HI* - Dashboard\n💰 *RENT* - View bill\n✅ *PAID* - Record payment\n📜 *HISTORY* - Past payments`);
    }
}

async function handleSmartPayment(phone, body) {
    const clean = body.trim().toUpperCase();
    const contextName = userState[phone]?.contextName;
    const tenant = await sheetsService.getTenantByPhone(phone, contextName);
    if (!tenant) return false;

    const rent = parseFloat(tenant.get('Monthly Rent') || 0);
    const eb = parseFloat(tenant.get('EB Amount') || 0);
    const total = rent + eb;

    // ===== "PAID BY UPI" — Direct UPI payment flow =====
    if (clean === 'PAID BY UPI' || clean === 'PAID UPI' || clean === 'PAY BY UPI' || clean === 'UPI PAID') {
        const razorpayLink = await createRazorpayLink(phone, tenant.get('Name'), total, tenant.get('Room'));
        const upiLink = `upi://pay?pa=${config.upiId}&pn=${encodeURIComponent(config.businessName)}&am=${total}&cu=INR`;

        let msg = `💳 *Pay via UPI/APP*\n\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Total: ₹${total}*\n\n👇 *Pay using UPI:*\n${upiLink}`;
        if (razorpayLink) msg += `\n\n💳 *Or Pay Online (Razorpay):*\n${razorpayLink}\n_After payment, you'll be redirected back here._`;
        msg += `\n\n✅ After payment, send your *Transaction ID / UTR Number* here.`;

        userState[phone] = { step: 'UPI_TXN_ID', contextName: tenant.get('Name'), amount: total };
        await sendMessage(phone, msg);
        return true;
    }

    // ===== "PAID BY CASH" — Direct Cash payment flow =====
    if (clean === 'PAID BY CASH' || clean === 'PAID CASH' || clean === 'PAY BY CASH' || clean === 'CASH PAID' || clean === 'COD') {
        // Check if amount is included
        const amountMatch = body.match(/\d{3,}/);
        if (amountMatch) {
            // Amount provided inline - process immediately
            const amount = amountMatch[0];
            const trxId = `CASH-${Date.now().toString().slice(-6)}`;

            await sheetsService.updateTenant(phone, {
                'Status': 'PAID', 'Payment Mode': 'CASH',
                'Transaction ID': trxId, 'Paid Date': new Date().toLocaleDateString()
            }, contextName);
            await sheetsService.logPayment(tenant, amount, 'CASH', trxId);

            const { filePath } = await pdfService.generateInvoice({
                Name: tenant.get('Name'), Phone: tenant.get('Phone'), Room: tenant.get('Room'),
                EB_Amount: eb.toString(), Monthly_Rent: rent.toString(), Total_Amount: amount,
                Paid_Date: new Date().toLocaleDateString(), Transaction_ID: trxId, Payment_Mode: 'CASH'
            });

            await sendMessage(phone, `✅ *Cash Payment Confirmed!*\n\nHi ${tenant.get('Name')},\n\n📋 *Breakdown:*\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n💰 *Total Paid: ₹${amount}*\n\n💵 Mode: CASH\n🔖 Receipt: ${trxId}\n📅 Date: ${new Date().toLocaleDateString()}\n\nThank you! 🙏`);
            await sendMedia(phone, filePath, '📄 Your payment receipt');

            if (config.ownerPhone) {
                await sendMessage(config.ownerPhone, `💵 *Cash Payment*\nTenant: ${tenant.get('Name')}\nRoom: ${tenant.get('Room')}\nRent: ₹${rent} | EB: ₹${eb}\nTotal: ₹${amount}\nReceipt: ${trxId}`);
            }
            return true;
        }

        // No amount — ask for amount
        userState[phone] = { step: 'CASH_AMOUNT', contextName: tenant.get('Name'), expectedTotal: total };
        await sendMessage(phone, `💵 *Cash Payment*\n\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Total Due (Rent + EB): ₹${total}*\n\nPlease type your *total rent and eb amount paid*.\nExample: *${total}*`);
        return true;
    }

    // ===== "PAID CASH 6400" — Cash with amount =====
    if (clean.includes('PAID') && clean.includes('CASH')) {
        const amountMatch = body.match(/\d{3,}/);
        if (amountMatch) {
            const amount = amountMatch[0];
            const trxId = `CASH-${Date.now().toString().slice(-6)}`;

            await sheetsService.updateTenant(phone, {
                'Status': 'PAID', 'Payment Mode': 'CASH',
                'Transaction ID': trxId, 'Paid Date': new Date().toLocaleDateString()
            }, contextName);
            await sheetsService.logPayment(tenant, amount, 'CASH', trxId);

            const { filePath } = await pdfService.generateInvoice({
                Name: tenant.get('Name'), Phone: tenant.get('Phone'), Room: tenant.get('Room'),
                EB_Amount: eb.toString(), Monthly_Rent: rent.toString(), Total_Amount: amount,
                Paid_Date: new Date().toLocaleDateString(), Transaction_ID: trxId, Payment_Mode: 'CASH'
            });

            await sendMessage(phone, `✅ *Cash Payment Confirmed!*\n\nHi ${tenant.get('Name')},\n\n📋 *Breakdown:*\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n💰 *Total Paid: ₹${amount}*\n\n💵 Mode: CASH\n🔖 Receipt: ${trxId}\n📅 Date: ${new Date().toLocaleDateString()}\n\nThank you! 🙏`);
            await sendMedia(phone, filePath, '📄 Your payment receipt');

            if (config.ownerPhone) {
                await sendMessage(config.ownerPhone, `💵 *Cash Payment*\nTenant: ${tenant.get('Name')}\nRoom: ${tenant.get('Room')}\nRent: ₹${rent} | EB: ₹${eb}\nTotal: ₹${amount}\nReceipt: ${trxId}`);
            }
            return true;
        }
        return false;
    }

    // ===== "PAID UTR123456789" — UPI with inline TXN ID =====
    if (clean.includes('PAID')) {
        const trxMatch = clean.match(/[A-Z0-9]{10,}/);
        if (trxMatch) {
            const trxId = trxMatch[0];

            await sheetsService.updateTenant(phone, {
                'Status': 'PAID', 'Payment Mode': 'UPI',
                'Transaction ID': trxId, 'Paid Date': new Date().toLocaleDateString()
            }, contextName);
            await sheetsService.logPayment(tenant, total.toString(), 'UPI', trxId);

            const { filePath } = await pdfService.generateInvoice({
                Name: tenant.get('Name'), Phone: tenant.get('Phone'), Room: tenant.get('Room'),
                EB_Amount: eb.toString(), Monthly_Rent: rent.toString(), Total_Amount: total.toString(),
                Paid_Date: new Date().toLocaleDateString(), Transaction_ID: trxId, Payment_Mode: 'UPI'
            });

            await sendMessage(phone, `✅ *UPI Payment Confirmed!*\n\nHi ${tenant.get('Name')},\n\n📋 *Breakdown:*\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n💰 *Total Paid: ₹${total}*\n\n💳 Mode: UPI\n🔖 TXN ID: ${trxId}\n📅 Date: ${new Date().toLocaleDateString()}\n\nThank you! 🙏`);
            await sendMedia(phone, filePath, '📄 Your payment receipt');

            if (config.ownerPhone) {
                await sendMessage(config.ownerPhone, `💰 *UPI Payment*\nTenant: ${tenant.get('Name')}\nRoom: ${tenant.get('Room')}\nRent: ₹${rent} | EB: ₹${eb}\nTotal: ₹${total}\nTXN: ${trxId}`);
            }
            return true;
        } else if (clean === 'PAID') {
            return false; // Let the switch-case handle bare "PAID" command
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
    const rent = (tenant.get('Monthly Rent') || '0').toString().replace(/[^\d.]/g, '');
    const eb = (tenant.get('EB Amount') || '0').toString().replace(/[^\d.]/g, '');
    const total = parseFloat(rent) + parseFloat(eb);
    const status = tenant.get('Status') || 'PENDING';

    const now = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonth = monthNames[now.getMonth()];
    const dueDate = `${config.rentDueDate}th ${currentMonth}`;

    let caption = `🧾 *Invoice & Payment*\n\nHi ${name},\n💰 *Total Due: ₹${total}*\n📅 *Due Date: ${dueDate}*\n\n📋 *Breakdown:*\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n━━━━━━━━━━━━━━━━━━━━\n💵 *Total: ₹${total}*`;

    const razorpayLink = await createRazorpayLink(phone, name, total, tenant.get('Room'));
    if (razorpayLink) caption += `\n\n💳 *Pay Online:*\n${razorpayLink}`;

    const upiLink = `upi://pay?pa=${config.upiId}&pn=${encodeURIComponent(config.businessName)}&am=${total}&cu=INR`;
    caption += `\n\n👇 *Quick UPI Pay:*\n${upiLink}`;

    // Generate PDF
    const { filePath } = await pdfService.generateInvoice({
        Name: name, Phone: phone, Room: tenant.get('Room') || 'N/A',
        EB_Amount: eb, Monthly_Rent: rent, Total_Amount: total.toString(),
        Paid_Date: 'PENDING', Transaction_ID: 'PENDING', Payment_Mode: 'PENDING'
    });

    if (status === 'PAID') {
        await sendMedia(phone, filePath, caption + `\n\n✅ *Payment Status: PAID*`, null, 'StayFlow_Invoice.pdf');
    } else {
        userState[phone] = { step: 'PAYMENT_METHOD', contextName: name };
        await sendMedia(phone, filePath, caption + `\n\n━━━━━━━━━━━━━━━━━━━━\n*How did you pay?* Tap below 👇`, ["💳 Paid by UPI", "💵 Paid by Cash"], 'StayFlow_Invoice.pdf');
    }
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

        // ========== PAYMENT FLOW STATES ==========
        case 'PAYMENT_METHOD': {
            const choice = input.trim().toUpperCase();
            const isUPI = choice === '1' || choice === 'UPI' || choice === 'UPI/APP' || choice.includes('UPI') || choice.includes('PAID BY UPI');
            const isCash = choice === '2' || choice === 'CASH' || choice === 'COD' || choice.includes('CASH') || choice.includes('PAID BY CASH');
            const isCancel = choice === '3' || choice === 'CANCEL' || choice === 'NO' || choice.includes('CANCEL');

            if (isCancel) {
                await sendMessage(phone, '❌ Payment cancelled. Type *PAID* anytime to try again.');
                delete userState[phone];
            } else if (isUPI) {
                const tenant = await sheetsService.getTenantByPhone(phone, state.contextName);
                if (!tenant) { await sendMessage(phone, 'Tenant not found.'); delete userState[phone]; return; }
                const rent = parseFloat(tenant.get('Monthly Rent') || 0);
                const eb = parseFloat(tenant.get('EB Amount') || 0);
                const total = rent + eb;
                const razorpayLink = await createRazorpayLink(phone, tenant.get('Name'), total, tenant.get('Room'));
                const upiLink = `upi://pay?pa=${config.upiId}&pn=${encodeURIComponent(config.businessName)}&am=${total}&cu=INR`;

                // CHOICE 1 Flow
                let msg = `💳 *Option 1: Pay via UPI/APP*\n\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Total: ₹${total}*\n\n👇 *Pay using UPI:*\n${upiLink}`;
                if (razorpayLink) msg += `\n\n🔗 *Pay Online (Razorpay):*\n${razorpayLink}\n_✅ After paying, you'll be redirected back here._`;
                msg += `\n\n📩 After payment, send your *Transaction ID / UTR Number* here to get your receipt.`;

                state.step = 'UPI_TXN_ID';
                state.amount = total;
                await sendMessage(phone, msg);
            } else if (isCash) {
                const tenant = await sheetsService.getTenantByPhone(phone, state.contextName);
                if (!tenant) { await sendMessage(phone, 'Tenant not found.'); delete userState[phone]; return; }
                const rent = parseFloat(tenant.get('Monthly Rent') || 0);
                const eb = parseFloat(tenant.get('EB Amount') || 0);
                const total = rent + eb;
                state.step = 'CASH_AMOUNT';
                state.expectedTotal = total;

                // CHOICE 2 Flow
                await sendMessage(phone, `💵 *Option 2: Cash Payment*\n\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Total Due (Rent + EB): ₹${total}*\n\nPlease type the *total rent and eb amount* you paid.\nExample: *${total}*`);
            } else {
                await sendButtons(phone, '❌ Please select a payment method:', ["1. UPI/APP", "2. Cash", "Cancel"]);
            }
            break;
        }

        case 'UPI_TXN_ID': {
            const trxId = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (trxId.length < 6) {
                await sendMessage(phone, '❌ Transaction ID seems too short. Please send the complete *Transaction/UTR ID*.');
                return;
            }
            const tenant = await sheetsService.getTenantByPhone(phone, state.contextName);
            if (!tenant) { await sendMessage(phone, 'Tenant not found.'); delete userState[phone]; return; }

            const rent = parseFloat(tenant.get('Monthly Rent') || 0);
            const eb = parseFloat(tenant.get('EB Amount') || 0);
            const total = rent + eb;

            await sheetsService.updateTenant(phone, {
                'Status': 'PAID', 'Payment Mode': 'UPI',
                'Transaction ID': trxId, 'Paid Date': new Date().toLocaleDateString()
            }, state.contextName);
            await sheetsService.logPayment(tenant, total.toString(), 'UPI', trxId);

            // Generate invoice PDF
            const { filePath } = await pdfService.generateInvoice({
                Name: tenant.get('Name'), Phone: tenant.get('Phone'), Room: tenant.get('Room'),
                EB_Amount: eb.toString(), Monthly_Rent: rent.toString(), Total_Amount: total.toString(),
                Paid_Date: new Date().toLocaleDateString(), Transaction_ID: trxId, Payment_Mode: 'UPI'
            });

            await sendMessage(phone, `✅ *UPI Payment Confirmed!*\n\nHi ${tenant.get('Name')},\n\n📋 *Breakdown:*\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n💰 *Total Paid: ₹${total}*\n\n💳 Mode: UPI\n🔖 TXN ID: ${trxId}\n📅 Date: ${new Date().toLocaleDateString()}\n\nThank you! 🙏`);
            await sendMedia(phone, filePath, '📄 Your payment receipt');

            if (config.ownerPhone) {
                await sendMessage(config.ownerPhone, `💰 *UPI Payment*\nTenant: ${tenant.get('Name')}\nRoom: ${tenant.get('Room')}\nRent: ₹${rent} | EB: ₹${eb}\nTotal: ₹${total}\nTXN: ${trxId}`);
            }
            delete userState[phone];
            break;
        }

        case 'CASH_AMOUNT': {
            const amount = parseFloat(input.replace(/[^0-9.]/g, ''));
            if (isNaN(amount) || amount <= 0) {
                await sendMessage(phone, '❌ Please enter a valid amount. Example: *6400*');
                return;
            }
            const tenant = await sheetsService.getTenantByPhone(phone, state.contextName);
            if (!tenant) { await sendMessage(phone, 'Tenant not found.'); delete userState[phone]; return; }

            const rent = parseFloat(tenant.get('Monthly Rent') || 0);
            const eb = parseFloat(tenant.get('EB Amount') || 0);
            const trxId = `CASH-${Date.now().toString().slice(-6)}`;

            await sheetsService.updateTenant(phone, {
                'Status': 'PAID', 'Payment Mode': 'CASH',
                'Transaction ID': trxId, 'Paid Date': new Date().toLocaleDateString()
            }, state.contextName);
            await sheetsService.logPayment(tenant, amount.toString(), 'CASH', trxId);

            // Generate invoice PDF
            const { filePath } = await pdfService.generateInvoice({
                Name: tenant.get('Name'), Phone: tenant.get('Phone'), Room: tenant.get('Room'),
                EB_Amount: eb.toString(), Monthly_Rent: rent.toString(), Total_Amount: amount.toString(),
                Paid_Date: new Date().toLocaleDateString(), Transaction_ID: trxId, Payment_Mode: 'CASH'
            });

            await sendMessage(phone, `✅ *Cash Payment Confirmed!*\n\nHi ${tenant.get('Name')},\n\n📋 *Breakdown:*\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n💰 *Total Paid: ₹${amount}*\n\n💵 Mode: CASH\n🔖 Receipt: ${trxId}\n📅 Date: ${new Date().toLocaleDateString()}\n\nThank you! 🙏`);
            await sendMedia(phone, filePath, '📄 Your payment receipt');

            if (config.ownerPhone) {
                await sendMessage(config.ownerPhone, `💵 *Cash Payment*\nTenant: ${tenant.get('Name')}\nRoom: ${tenant.get('Room')}\nRent: ₹${rent} | EB: ₹${eb}\nTotal: ₹${amount}\nReceipt: ${trxId}`);
            }
            delete userState[phone];
            break;
        }

        case 'PAYMENT_PROOF': {
            // Tenant sent a transaction ID after saying "PAID"
            const trxId = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (trxId.length < 6) {
                await sendMessage(phone, '❌ Please send a valid *Transaction/UTR ID* (at least 6 characters).');
                return;
            }
            const tenant = await sheetsService.getTenantByPhone(phone, state.contextName);
            if (!tenant) { await sendMessage(phone, 'Tenant not found.'); delete userState[phone]; return; }

            const rent = parseFloat(tenant.get('Monthly Rent') || 0);
            const eb = parseFloat(tenant.get('EB Amount') || 0);
            const total = rent + eb;

            await sheetsService.updateTenant(phone, {
                'Status': 'PAID', 'Payment Mode': 'UPI',
                'Transaction ID': trxId, 'Paid Date': new Date().toLocaleDateString()
            }, state.contextName);
            await sheetsService.logPayment(tenant, total.toString(), 'UPI', trxId);

            const { filePath } = await pdfService.generateInvoice({
                Name: tenant.get('Name'), Phone: tenant.get('Phone'), Room: tenant.get('Room'),
                EB_Amount: eb.toString(), Monthly_Rent: rent.toString(), Total_Amount: total.toString(),
                Paid_Date: new Date().toLocaleDateString(), Transaction_ID: trxId, Payment_Mode: 'UPI'
            });

            await sendMessage(phone, `✅ *Payment Verified!*\n\nTXN ID: ${trxId}\nTotal: ₹${total}\n\nThank you! 🙏`);
            await sendMedia(phone, filePath, '📄 Your payment receipt');

            if (config.ownerPhone) {
                await sendMessage(config.ownerPhone, `💰 *UPI Payment*\nTenant: ${tenant.get('Name')}\nRoom: ${tenant.get('Room')}\nTotal: ₹${total}\nTXN: ${trxId}`);
            }
            delete userState[phone];
            break;
        }

        case 'HELP_CATEGORY': {
            const category = input.trim().replace(/[^\w\s]/g, '').trim() || 'General';
            userState[phone] = { step: 'HELP_REASON', helpCategory: category };
            await sendMessage(phone, `📝 *Category: ${category}*\n\nPlease describe your issue in detail.\n\n_Example: "Water leaking from bathroom ceiling in Room 5"_`);
            break;
        }

        case 'HELP_REASON': {
            const helpCategory = state.helpCategory || 'General';
            const tenant = await sheetsService.getTenantByPhone(phone);
            const tenantName = tenant ? tenant.get('Name') : phone;
            const tenantRoom = tenant ? tenant.get('Room') : 'N/A';

            await sendMessage(phone, `✅ *Complaint Registered!*\n\n📌 Category: ${helpCategory}\n📝 Issue: "${input}"\n\nOur team will look into it and get back to you shortly. Thank you for your patience! 🙏`);

            if (config.ownerPhone) {
                await sendMessage(config.ownerPhone, `🆘 *Help Request Received*\n━━━━━━━━━━━━━━━━━━━━\n👤 From: ${tenantName}\n📞 Phone: ${phone}\n🚪 Room: ${tenantRoom}\n📌 Category: ${helpCategory}\n📝 Issue: ${input}\n━━━━━━━━━━━━━━━━━━━━\n_Reply to ${phone} directly to respond._`);
            }
            delete userState[phone];
            break;
        }

        case 'ANNOUNCE_MSG': {
            if (phone !== config.ownerPhone) {
                await sendMessage(phone, '❌ Only admin can send announcements.');
                delete userState[phone];
                return;
            }
            const allTenants = await sheetsService.getAllTenants();
            const active = allTenants.filter(t => t.get('Status') !== 'VACATED');
            let sentCount = 0;
            for (const t of active) {
                const tPhone = t.get('Phone');
                if (!tPhone) continue;
                try {
                    await sendMessage(tPhone, `📢 *Announcement*\n\n${input}`);
                    sentCount++;
                } catch (e) { console.error(`Announce error for ${tPhone}:`, e.message); }
            }
            await sendMessage(phone, `✅ Announcement sent to ${sentCount} tenants.`);
            delete userState[phone];
            break;
        }

        // ========== ONBOARDING FLOW STATES ==========
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

            // Send to tenant (if registered by admin) or user (if self-registering)
            const targetPhone = state.userPhone || phone;

            // Generate Registration PDF
            const { fileName: regFile, filePath: regPath } = await pdfService.generateRegistrationForm({
                name: state.name, phone: targetPhone, room: state.room,
                sharingType: state.sharingType, advance: state.advance,
                monthlyRent: state.monthlyRent
            });

            const tenantObj = {
                name: state.name, phone: targetPhone, room: state.room,
                advance: state.advance, sharingType: state.sharingType, monthlyRent: state.monthlyRent,
                aadhaarImage: image.id,
                registrationForm: regFile
            };

            await sheetsService.init();
            await sheetsService.addTenant(tenantObj);

            const finalMsg = `✅ *Registration Successful!* 🎉\n\nWelcome to *${config.businessName}*. You are now part of our community! 🏠\n\n🏢 *PG House Rules & Regulations*\n━━━━━━━━━━━━━━━━━━━━\n⚖️ *DO's:*\n1. Keep your room and shared areas clean and hygienic.\n2. Maintain silence after 10:00 PM for everyone's comfort.\n3. Pay rent by the 5th and EB bills by the 10th of each month.\n4. Inform the admin 30 days before vacating.\n5. Cooperate with police verification and security checks.\n\n🚫 *DON'Ts:*\n1. Strictly NO smoking, alcohol, or illegal substances.\n2. No overnight visitors allowed without prior permission.\n3. Do not use heavy appliances (Heaters/AC/Iron) without approval.\n4. No loud music, parties, or disturbances in rooms.\n5. Do not damage PG property or furniture.\n\n📜 *Note:* Rules are for the safety and comfort of all residents. Violations may lead to penalties or eviction.\n━━━━━━━━━━━━━━━━━━━━\n\n🤖 *How to Use:* Type *HI* anytime to see your dashboard!`;

            await sendMessage(targetPhone, finalMsg);
            await sendMedia(targetPhone, regPath, '📄 Your registration copy', null, 'StayFlow_Registration.pdf');

            if (config.ownerPhone && targetPhone !== config.ownerPhone) {
                await sendMessage(config.ownerPhone, `📝 *New Registration Received*\nName: ${state.name}\nRoom: ${state.room}\nPhone: ${targetPhone}`);
                await sendMedia(config.ownerPhone, regPath, `📝 Registration copy: ${state.name}`, null, 'StayFlow_Registration.pdf');
            }

            delete userState[phone];
            break;

        default:
            await sendMessage(phone, "I didn't understand that. Type *HI* to see what I can do!");
            delete userState[phone];
            break;
    }
}

export {
    handleIncomingMessage,
    sendMessage,
    sendMedia,
    sendImage,
    createRazorpayLink,
    setTenantContext,
    handleUpdateEB
};
