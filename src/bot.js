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
        // Primary: Point to StayFlow website payment page with embedded Razorpay checkout
        const websiteUrl = 'https://stay-flow-kohl.vercel.app';
        const paymentPageUrl = `${websiteUrl}/payment.html?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(name)}`;
        return paymentPageUrl;
    } catch (err) {
        console.error('Payment URL Generation Failed:', err.message);

        // Fallback: Create external Razorpay link
        try {
            const baseUrl = config.whatsapp.callbackUrl ? config.whatsapp.callbackUrl.replace('/webhook', '') : 'https://stayflow-hnm3.onrender.com';
            const confirmationUrl = `${baseUrl}/confirmation.html?phone=${encodeURIComponent(phone)}`;

            const paymentLink = await razorpay.paymentLink.create({
                amount: Math.round(amount * 100),
                currency: "INR",
                accept_partial: false,
                description: `StayFlow Rent & EB - ${name} (Room ${room})`,
                customer: {
                    name: name,
                    contact: phone.toString().slice(-10),
                    email: "tenant@stayflow.com"
                },
                notify: { sms: true, email: true },
                reminder_enable: true,
                callback_url: confirmationUrl,
                callback_method: 'get',
                notes: { room, phone, tenant_name: name }
            });
            return paymentLink.short_url;
        } catch (fallbackErr) {
            console.error('Razorpay Fallback Link Failed:', fallbackErr.message);
            return null;
        }
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

// Send WhatsApp Interactive List Message
async function sendListMessage(to, headerText, bodyText, buttonText, sections) {
    const cleanTo = normalizePhone(to);
    try {
        const payload = {
            messaging_product: "whatsapp",
            to: cleanTo,
            type: "interactive",
            interactive: {
                type: "list",
                header: { type: "text", text: headerText },
                body: { text: bodyText },
                action: {
                    button: buttonText,
                    sections: sections
                }
            }
        };
        await axios.post(
            `https://graph.facebook.com/v17.0/${config.whatsapp.phoneNumberId}/messages`,
            payload,
            { headers: { Authorization: `Bearer ${config.whatsapp.token}` } }
        );
    } catch (err) {
        console.error('Error sending list message:', err.response ? JSON.stringify(err.response.data) : err.message);
        // Fallback: send as plain text
        let fallbackMsg = `${headerText}\n\n${bodyText}\n\n`;
        sections.forEach(s => {
            fallbackMsg += `*${s.title}*\n`;
            s.rows.forEach(r => {
                fallbackMsg += `▸ ${r.title}${r.description ? ' — ' + r.description : ''}\n`;
            });
            fallbackMsg += '\n';
        });
        await sendMessage(to, fallbackMsg);
    }
}

// Send CTA URL Button (click-to-action link)
async function sendCTAButton(to, bodyText, buttonText, url, headerText = null) {
    const cleanTo = normalizePhone(to);
    try {
        const interactive = {
            type: "cta_url",
            body: { text: bodyText },
            action: {
                name: "cta_url",
                parameters: {
                    display_text: buttonText,
                    url: url
                }
            }
        };
        if (headerText) interactive.header = { type: "text", text: headerText };

        await axios.post(
            `https://graph.facebook.com/v17.0/${config.whatsapp.phoneNumberId}/messages`,
            {
                messaging_product: "whatsapp",
                to: cleanTo,
                type: "interactive",
                interactive: interactive
            },
            { headers: { Authorization: `Bearer ${config.whatsapp.token}` } }
        );
    } catch (err) {
        console.error('Error sending CTA button:', err.response ? JSON.stringify(err.response.data) : err.message);
        // Fallback: send URL as text
        await sendMessage(to, `${bodyText}\n\n🔗 ${buttonText}: ${url}`);
    }
}

// Send Call CTA Button (click-to-call)
async function sendCallCTA(to, bodyText, buttonDisplayText, phoneNumber) {
    const cleanTo = normalizePhone(to);
    const callUrl = `tel:${phoneNumber}`;
    try {
        // WhatsApp doesn't have a native 'call' CTA, so we use phone link as CTA URL
        // Alternatively, we send the number with a message to call
        await sendMessage(to, `${bodyText}\n\n📞 *Tap to Call:*\nhttps://wa.me/${normalizePhone(phoneNumber)}\n\nOr dial directly: *${phoneNumber}*`);
    } catch (err) {
        console.error('Error sending call CTA:', err.response ? JSON.stringify(err.response.data) : err.message);
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

            const razorpayLink = await createRazorpayLink(phone, tenantForPaid.get('Name'), paidTotal, tenantForPaid.get('Room'));

            let payMsg = `💳 *Pay Online (UPI/Card)*\n\n🏠 Rent: ₹${paidRent}\n⚡ EB: ₹${paidEB}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Total: ₹${paidTotal}*\n\n_Pay securely on our website via Razorpay._`;

            if (razorpayLink) {
                await sendCTAButton(phone, payMsg, '💳 Pay Now', razorpayLink, '💳 Secure Payment');
            } else {
                await sendMessage(phone, `❌ Online payment is currently unavailable. Please contact admin.`);
            }
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
            await sendMessage(phone, `💵 *Cash Payment*\n\n🏠 Rent: ₹${cashRent}\n⚡ EB: ₹${cashEB}\n💰 *Total Due: ₹${cashTotal}*\n\nPlease enter the *amount paid*.\nExample: *${cashTotal}*\n\n⚠️ _Invoice will be generated after admin verification._`);
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

        // ==================== WELCOME / HI MESSAGE WITH LIST MENU ====================
        case 'HI':
        case 'HII':
        case 'HIE':
        case 'HELO':
        case 'HELLO':
        case 'HOLA':
        case 'HAI':
        case 'HEY':
        case 'NAMASTE': {
            const tenantForHi = await sheetsService.getTenantByPhone(phone);
            const isRegistered = tenantForHi && tenantForHi.get('Status') !== 'VACATED';

            // Build dynamic welcome text
            let welcomeBody = '';
            if (isRegistered) {
                const name = tenantForHi.get('Name');
                const room = tenantForHi.get('Room') || 'N/A';
                const rent = parseFloat(tenantForHi.get('Monthly Rent') || 0);
                const eb = parseFloat(tenantForHi.get('EB Amount') || 0);
                const total = rent + eb;
                const status = tenantForHi.get('Status') || 'ACTIVE';
                const statusEmoji = status === 'PAID' ? '✅' : (status === 'PENDING' ? '⏳' : '🔔');
                welcomeBody = `Welcome back, *${name}*! 👋\n\n🚪 Room: ${room}\n${statusEmoji} Status: *${status}*\n\n💰 *Current Bill:*\n🏠 Rent: ₹${rent} | ⚡ EB: ₹${eb}\n💵 *Total: ₹${total}*\n\nPlease select an option below 👇`;
            } else {
                welcomeBody = `Hello! 👋 Welcome to *${config.businessName}*.\n\nWe're happy to have you here! Please select an option below to get started 👇`;
            }

            // Build menu rows — dynamically swap "New Register" ↔ "Vacate" based on registration
            const mainMenuRows = [];
            if (isRegistered) {
                mainMenuRows.push({ id: 'menu_vacate', title: '🚪 Vacate', description: 'Request to vacate your room' });
            } else {
                mainMenuRows.push({ id: 'menu_register', title: '📝 New Register', description: 'Register as a new tenant' });
            }
            mainMenuRows.push(
                { id: 'menu_rent', title: '🏠 Rent', description: 'View rent details & bill' },
                { id: 'menu_pay', title: '💳 Pay via Razorpay', description: 'Pay your bill securely' },
                { id: 'menu_eb_bill', title: '⚡ EB Bill', description: 'View electricity bill' },
                { id: 'menu_statements', title: '📜 Statements', description: 'Monthly payment statements' },
                { id: 'menu_queries', title: '❓ Queries', description: 'Submit a query or complaint' }
            );

            const infoMenuRows = [
                { id: 'menu_holidays', title: '🎉 Holiday List', description: 'View upcoming holidays' },
                { id: 'menu_rules', title: '📋 Rules', description: 'PG house rules & regulations' },
                { id: 'menu_vacancy', title: '🛏️ Vacancy Rooms', description: 'Check available rooms' },
                { id: 'menu_refer', title: '👥 Refer a Friend', description: 'Refer someone & earn rewards' }
            ];

            const sections = [
                { title: '🏠 Services', rows: mainMenuRows },
                { title: 'ℹ️ Information', rows: infoMenuRows }
            ];

            // Send welcome banner if available
            const welcomeBanner = path.join(__dirname, '../assets/START BANNER.png');
            if (fs.existsSync(welcomeBanner)) await sendImage(phone, welcomeBanner);

            await sendListMessage(
                phone,
                `🏠 ${config.businessName}`,
                welcomeBody,
                '📋 View Menu',
                sections
            );

            try {
                if (isRegistered) {
                    await sheetsService.logNotification(phone, tenantForHi.get('Name'), 'WELCOME_MENU', 'Tenant viewed welcome menu');
                }
            } catch (e) { }
            break;
        }

        // ==================== LIST MENU SELECTIONS ====================
        // New Register (from list)
        case 'MENU_REGISTER':
        case '📝 NEW REGISTER': {
            const regUrl = config.googleFormUrl || 'https://forms.gle/YOUR_FORM_ID';
            await sendCTAButton(
                phone,
                `📝 *New Registration*\n\nJoin *${config.businessName}* by filling out the registration form.\n\nClick the button below to register 👇`,
                '📝 Register Now',
                regUrl,
                '🏠 Welcome to ' + config.businessName
            );
            break;
        }

        // Vacate (from list — registered users)
        case 'MENU_VACATE':
        case '🚪 VACATE': {
            await handleTenantVacateRequest(phone);
            break;
        }

        // Rent (from list)
        case 'MENU_RENT':
        case '🏠 RENT': {
            await handleMenuRent(phone);
            break;
        }

        // Pay (from list)
        case 'MENU_PAY':
        case '💳 PAY VIA RAZORPAY': {
            // Trigger the PAID command logic
            const tenantPay = await sheetsService.getTenantByPhone(phone);
            if (!tenantPay || tenantPay.get('Status') === 'VACATED') {
                await sendMessage(phone, "You're not registered. Type *HI* to start.");
                break;
            }
            const rentAmt = parseFloat(tenantPay.get('Monthly Rent') || 0);
            const ebAmt = parseFloat(tenantPay.get('EB Amount') || 0);
            const totalAmt = rentAmt + ebAmt;

            const razorpayLink = await createRazorpayLink(phone, tenantPay.get('Name'), totalAmt, tenantPay.get('Room'));

            let payMsg = `💳 *Pay Online (Razorpay)*\n\n🏠 Rent: ₹${rentAmt}\n⚡ EB: ₹${ebAmt}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Total: ₹${totalAmt}*\n\n_Pay securely on our website via Razorpay._`;

            if (razorpayLink) {
                await sendCTAButton(phone, payMsg, '💳 Pay Now', razorpayLink, '💳 Secure Payment');
            } else {
                await sendMessage(phone, `❌ Online payment is currently unavailable. Please contact admin.`);
            }
            break;
        }

        // EB Bill (from list)
        case 'MENU_EB_BILL':
        case '⚡ EB BILL': {
            await handleMenuEBBill(phone);
            break;
        }

        // Statements (from list)
        case 'MENU_STATEMENTS':
        case '📜 STATEMENTS': {
            await handleMenuStatements(phone);
            break;
        }

        // Queries (from list)
        case 'MENU_QUERIES':
        case '❓ QUERIES': {
            const baseUrl = config.whatsapp.callbackUrl ? config.whatsapp.callbackUrl.replace('/webhook', '') : 'https://stayflow.onrender.com';
            const queriesUrl = `${baseUrl}/queries.html?phone=${encodeURIComponent(phone)}`;
            await sendCTAButton(
                phone,
                `❓ *Submit a Query*\n\nHave a question or concern? Use the form below to send us your queries.\n\nOur team will review and get back to you shortly! 🙏`,
                '📝 Fill Query Form',
                queriesUrl,
                '❓ Queries & Support'
            );
            break;
        }

        // Holiday List (from list)
        case 'MENU_HOLIDAYS':
        case '🎉 HOLIDAY LIST': {
            await handleMenuHolidays(phone);
            break;
        }

        // Rules (from list)
        case 'MENU_RULES':
        case '📋 RULES': {
            const rulesMenuMsg = `🏢 *PG House Rules & Regulations*\n━━━━━━━━━━━━━━━━━━━━\n\n⚖️ *DO's:*\n1. Keep your room and shared areas clean and hygienic.\n2. Maintain silence after 10:00 PM for everyone's comfort.\n3. Pay rent by the 5th and EB bills by the 10th of each month.\n4. Inform the admin 30 days before vacating.\n5. Cooperate with police verification and security checks.\n\n🚫 *DON'Ts:*\n1. Strictly NO smoking, alcohol, or illegal substances.\n2. No overnight visitors allowed without prior permission.\n3. Do not use heavy appliances (Heaters/AC/Iron) without approval.\n4. No loud music, parties, or disturbances in rooms.\n5. Do not damage PG property or furniture.\n\n📜 *Note:* Rules are for the safety and comfort of all residents. Violations may lead to penalties or eviction.\n━━━━━━━━━━━━━━━━━━━━`;
            await sendMessage(phone, rulesMenuMsg);
            break;
        }

        // Vacancy Rooms (from list)
        case 'MENU_VACANCY':
        case '🛏️ VACANCY ROOMS': {
            await handleMenuVacancy(phone);
            break;
        }

        // Refer a Friend (from list)
        case 'MENU_REFER':
        case '👥 REFER A FRIEND': {
            await handleMenuRefer(phone);
            break;
        }

        // ==================== REPLY BUTTON HANDLERS ====================
        // Rent Pay Now UPI button
        case '💳 PAY NOW UPI':
        case 'PAY NOW UPI':
        case '💳 PAY NOW':
        case 'PAY NOW': {
            const tenantPay = await sheetsService.getTenantByPhone(phone);
            if (!tenantPay || tenantPay.get('Status') === 'VACATED') {
                await sendMessage(phone, "You're not registered. Type *HI* to start.");
                break;
            }
            const payRent = parseFloat(tenantPay.get('Monthly Rent') || 0);
            const payEB = parseFloat(tenantPay.get('EB Amount') || 0);
            const payTotal = payRent + payEB;

            const razorpayLink = await createRazorpayLink(phone, tenantPay.get('Name'), payTotal, tenantPay.get('Room'));

            let payMsg = `💳 *Pay Online (Razorpay)*\n\n🏠 Rent: ₹${payRent}\n⚡ EB: ₹${payEB}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Total: ₹${payTotal}*\n\n_Redirecting to secure gateway..._`;

            if (razorpayLink) {
                await sendCTAButton(
                    phone,
                    payMsg,
                    '💳 Pay Now',
                    razorpayLink,
                    '💳 Secure Payment'
                );
            } else {
                await sendMessage(phone, `❌ Online payment is currently unavailable. Please contact admin.`);
            }
            break;
        }

        // Pay Cash button
        case '💵 PAY CASH':
        case 'PAY CASH':
        case '💵 PAY BY CASH':
        case 'PAY BY CASH': {
            const tenantCash = await sheetsService.getTenantByPhone(phone);
            if (!tenantCash) break;
            const cashRent = parseFloat(tenantCash.get('Monthly Rent') || 0);
            const cashEB = parseFloat(tenantCash.get('EB Amount') || 0);
            const cashTotal = cashRent + cashEB;
            userState[phone] = { step: 'CASH_AMOUNT', contextName: tenantCash.get('Name'), expectedTotal: cashTotal };
            await sendMessage(phone, `💵 *Cash Payment*\n\n🏠 Rent: ₹${cashRent}\n⚡ EB: ₹${cashEB}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Total Due: ₹${cashTotal}*\n\nPlease enter the *exact amount paid*.\nExample: *${cashTotal}*`);
            break;
        }

        // Cancel button
        case '❌ CANCEL':
        case 'CANCEL': {
            await sendMessage(phone, '❌ Payment cancelled. You can type *RENT* anytime to view your bill and pay.');
            delete userState[phone];
            break;
        }

        // Contact Admin button
        case '📞 CONTACT':
        case 'CONTACT':
        case 'CONTACT ADMIN': {
            const adminPhone = config.ownerPhone || '';
            await sendCallCTA(phone, `📞 *Contact Admin*\n\nFor any urgent queries, please contact our admin directly.`, '📞 Call Admin', adminPhone);
            break;
        }
        default:
            // Handle statement month selections (STMT_YYYY_M)
            if (cleanBody.startsWith('STMT_')) {
                const stmtParts = cleanBody.split('_');
                if (stmtParts.length === 3) {
                    const stmtYear = parseInt(stmtParts[1]);
                    const stmtMonth = parseInt(stmtParts[2]) - 1; // 0-indexed
                    await handleStatementMonth(phone, stmtYear, stmtMonth);
                    return;
                }
            }

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
                // ========== VERIFY UPI <phone> — Admin verifies UPI payment ==========
                if (cleanBody.startsWith('VERIFY UPI')) {
                    const parts = cleanBody.split(' ');
                    if (parts.length >= 3) {
                        const tenantPhone = parts[2];
                        await handleVerifyPayment(phone, tenantPhone);
                        return;
                    } else {
                        await sendMessage(phone, `Usage: VERIFY UPI [PHONE]\nExample: VERIFY UPI 919876543210`);
                        return;
                    }
                }
                // ========== VERIFY CASH <phone> — Admin verifies Cash payment ==========
                if (cleanBody.startsWith('VERIFY CASH')) {
                    const parts = cleanBody.split(' ');
                    if (parts.length >= 3) {
                        const tenantPhone = parts[2];
                        await handleVerifyPayment(phone, tenantPhone);
                        return;
                    } else {
                        await sendMessage(phone, `Usage: VERIFY CASH [PHONE]\nExample: VERIFY CASH 919876543210`);
                        return;
                    }
                }
                // ========== REJECT <phone> — Admin rejects payment ==========
                if (cleanBody.startsWith('REJECT')) {
                    const parts = cleanBody.split(' ');
                    if (parts.length >= 2) {
                        const tenantPhone = parts[1];
                        await handleRejectPayment(phone, tenantPhone);
                        return;
                    } else {
                        await sendMessage(phone, `Usage: REJECT [PHONE]\nExample: REJECT 919876543210`);
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
            userState[phone] = { step: 'PAYMENT_METHOD', contextName: name };
            await sendMessage(phone, `💰 *Payment - ${name}*\n\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n━━━━━━━━━━━━━━━━━━━━\n💵 *Total Due: ₹${total}*\n\n*How will you pay?*\n\n1️⃣ *Razorpay* - Secure Online Payment\n2️⃣ *CASH* - Paid by cash\n\nReply *1* or *2*`);
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

    // ===== "PAID" / "PAY" / "RENT" / "UPI" — Trigger Razorpay flow =====
    if (['PAID', 'PAY', 'RENT', 'UPI', 'UPI/APP'].includes(clean) || (clean.includes('PAID') && !clean.match(/[A-Z0-9]{10,}/) && !clean.includes('CASH'))) {
        const razorpayLink = await createRazorpayLink(phone, tenant.get('Name'), total, tenant.get('Room'));

        let msg = `💳 *Pay via UPI / Card*\n\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Total: ₹${total}*`;
        if (razorpayLink) {
            msg += `\n\n🌐 *Pay on our website:*\n${razorpayLink}\n\n_✅ Secure payment via Razorpay on StayFlow._`;
            await sendCTAButton(phone, msg, '💳 Pay Now', razorpayLink, '💳 Secure Payment');
        } else {
            msg += `\n\n❌ Online payment is currently unavailable. Please contact admin.`;
            await sendMessage(phone, msg);
        }
        return true;
    }

    // ===== "PAID BY CASH" — Cash payment flow =====
    if (clean.includes('CASH')) {
        userState[phone] = { step: 'CASH_AMOUNT', contextName: tenant.get('Name'), expectedTotal: total };
        await sendMessage(phone, `💵 *Cash Payment*\n\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Total Due: ₹${total}*\n\nPlease enter the *exact amount paid*.\nExample: *${total}*`);
        return true;
    }

    // ===== "PAID TXNID" — Detect Transaction ID and verify =====
    const trxMatch = clean.match(/[A-Z0-9]{10,}/);
    if (trxMatch || clean.startsWith('PAYMENT_')) {
        const trxId = trxMatch ? trxMatch[0] : clean;

        // Notify user we are checking
        await sendMessage(phone, `🔍 *Checking Transaction ID:* ${trxId}...\n_Please wait while we verify your payment._`);

        // We can't easily call the API from within the bot here without duplicate logic, 
        // so we'll look for the TXN in logs or sheets.
        const webhookLog = await Log.findOne({
            action: 'RAZORPAY_WEBHOOK',
            $or: [
                { 'details.payload.payment.entity.id': trxId },
                { 'details.payload.payment_link.entity.id': trxId },
                { 'details.payload.payment.entity.acquirer_data.rrn': trxId },
                { 'details.payload.payment.entity.acquirer_data.upi_transaction_id': trxId }
            ]
        });

        if (webhookLog) {
            const payload = webhookLog.details;
            const paymentEntity = payload.payload?.payment?.entity || payload.payload?.payment_link?.entity || {};
            await handleRazorpaySuccess(phone, (paymentEntity.amount || 0) / 100, trxId, 'UPI (Razorpay)');
            return true;
        }

        // If not found in logs, check if it's already in the sheet as PENDING and we just need to verify it
        // But for Razorpay Only flow, we usually wait for webhook.
        // As per requirements: "If Transaction ID does NOT match: ❌ Do NOT generate invoice ... Show message: “Transaction ID not found. Please contact support.”"
        await sendMessage(phone, `❌ *Transaction ID not found.*\n\nID: ${trxId}\n\nWe couldn't find a matching record for this ID yet. It might take a few minutes to sync.\n\n⚠️ If you have already paid, please try again in 5 minutes or contact support.`);
        return true;
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
    if (razorpayLink) caption += `\n\n💳 *Pay Online (Razorpay):*\n${razorpayLink}`;

    // Generate PDF
    const { filePath } = await pdfService.generateInvoice({
        Name: name, Phone: phone, Room: tenant.get('Room') || 'N/A',
        EB_Amount: eb, Monthly_Rent: rent, Total_Amount: total.toString(),
        Paid_Date: 'PENDING', Transaction_ID: 'PENDING', Payment_Mode: 'PENDING'
    });

    // Update tenant's current month's rent/eb/total in sheets
    // This ensures the latest bill is reflected if it changed
    await sheetsService.updateTenant(phone, {
        'EB Amount': eb.toString(),
        'Monthly Rent': rent.toString(),
        'Total Amount': total.toString()
    }, name); // Pass contextName for tenant lookup

    const isVerified = status === 'PAID' || status === 'VALID';
    if (isVerified) {
        await sendMedia(phone, filePath, caption + `\n\n✅ *Payment Status: VALID*`, null, 'StayFlow_Invoice.pdf');
    } else {
        userState[phone] = { step: 'PAYMENT_METHOD', contextName: name };
        await sendMedia(phone, filePath, caption + `\n\n━━━━━━━━━━━━━━━━━━━━\n*Select payment method to proceed* 👇`, ["💳 Pay Now UPI", "💵 Pay Cash", "❌ Cancel"], 'StayFlow_Invoice.pdf');
        // Send Contact Us CTA as a follow-up
        const adminPhone = config.ownerPhone || '';
        await sendCTAButton(phone, `📞 *Need help with payment?*\nContact our admin directly.`, '📞 Contact Us', `https://wa.me/${adminPhone}`);
    }
}

async function handleEB(phone) {
    const tenant = await sheetsService.getTenantByPhone(phone, userState[phone]?.contextName);
    if (!tenant) return;
    const eb = tenant.get('EB Amount') || '0';
    await sendMessage(phone, `⚡ Your Electricity Bill for this month is *₹${eb}*. This is included in your total rent.`);
}

// ==================== MENU HANDLER FUNCTIONS ====================

// Handle Rent from Menu — show rent with Pay Now / Contact buttons
async function handleMenuRent(phone) {
    const tenant = await sheetsService.getTenantByPhone(phone);
    if (!tenant || tenant.get('Status') === 'VACATED') {
        await sendMessage(phone, `❌ You are not registered yet.\n\nType *HI* and select *New Register* to join.`);
        return;
    }
    const name = tenant.get('Name');
    const room = tenant.get('Room') || 'N/A';
    const rent = parseFloat(tenant.get('Monthly Rent') || 0);
    const eb = parseFloat(tenant.get('EB Amount') || 0);
    const total = rent + eb;
    const status = tenant.get('Status') || 'PENDING';
    const now = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonth = monthNames[now.getMonth()];
    const dueDate = `${config.rentDueDate}th ${currentMonth}`;

    const isVerified = status === 'PAID' || status === 'VALID';
    let rentMsg = `🏠 *Rent Details — ${currentMonth}*\n━━━━━━━━━━━━━━━━━━━━\n\n👤 Name: ${name}\n🚪 Room: ${room}\n\n💰 *Bill Breakdown:*\n┌─────────────────────\n│ 🏠 Rent: ₹${rent}\n│ ⚡ EB: ₹${eb}\n└─────────────────────\n💵 *Total Due: ₹${total}*\n📅 *Due Date: ${dueDate}*\n\n${isVerified ? '✅ *Payment Status: VALID*' : (status === 'PENDING' ? '⏳ *Payment Status: PENDING*' : '❌ *Payment Status: INVALID*')}`;

    if (!isVerified) {
        // Show Razorpay + Cash + Cancel buttons
        await sendButtons(phone, rentMsg, ['💳 Pay via Razorpay', '💵 Pay Cash', '❌ Cancel']);
        userState[phone] = { step: 'PAYMENT_METHOD', contextName: name };
    } else {
        // Already paid — show contact only
        await sendButtons(phone, rentMsg, ['📞 Contact']);
    }
}

// Handle EB Bill from Menu — show EB bill with Total Rent / Contact buttons
async function handleMenuEBBill(phone) {
    const tenant = await sheetsService.getTenantByPhone(phone);
    if (!tenant || tenant.get('Status') === 'VACATED') {
        await sendMessage(phone, `❌ You are not registered yet.\n\nType *HI* and select *New Register* to join.`);
        return;
    }
    const name = tenant.get('Name');
    const room = tenant.get('Room') || 'N/A';
    const rent = parseFloat(tenant.get('Monthly Rent') || 0);
    const eb = parseFloat(tenant.get('EB Amount') || 0);
    const total = rent + eb;
    const now = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonth = monthNames[now.getMonth()];

    const ebMsg = `⚡ *Electricity Bill — ${currentMonth}*\n━━━━━━━━━━━━━━━━━━━━\n\n👤 Name: ${name}\n🚪 Room: ${room}\n\n⚡ *EB Amount: ₹${eb}*\n💡 Rate: ₹${config.ebUnitRate}/unit\n\n🏠 Rent: ₹${rent}\n━━━━━━━━━━━━━━━━━━━━\n💵 *Total (Rent + EB): ₹${total}*`;

    const status = tenant.get('Status') || 'PENDING';
    const isVerified = status === 'PAID' || status === 'VALID';
    if (!isVerified) {
        await sendButtons(phone, ebMsg, ['💳 Pay via Razorpay', '💵 Pay Cash', '❌ Cancel']);
        userState[phone] = { step: 'PAYMENT_METHOD', contextName: name };
    } else {
        await sendButtons(phone, ebMsg, ['📞 Contact']);
    }
}

// Handle Statements from Menu — show last 10 months as a list
async function handleMenuStatements(phone) {
    const tenant = await sheetsService.getTenantByPhone(phone);
    if (!tenant || tenant.get('Status') === 'VACATED') {
        await sendMessage(phone, `❌ You are not registered yet.\n\nType *HI* and select *New Register* to join.`);
        return;
    }

    // Generate list of last 10 months
    const now = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthRows = [];
    for (let i = 0; i < 10; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthLabel = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        monthRows.push({
            id: `stmt_${d.getFullYear()}_${d.getMonth() + 1}`,
            title: monthLabel,
            description: `View ${monthLabel} statement`
        });
    }

    await sendListMessage(
        phone,
        '📜 Monthly Statements',
        `Hi *${tenant.get('Name')}*! 👋\n\nSelect a month below to view your detailed payment statement for that month.`,
        '📅 Select Month',
        [{ title: '📅 Choose Month', rows: monthRows }]
    );
}

// Handle Holiday List from Menu
async function handleMenuHolidays(phone) {
    // Admin can update this list from the backend. For now, show common holidays.
    const now = new Date();
    const year = now.getFullYear();
    const holidayMsg = `🎉 *Holiday List — ${year}*\n━━━━━━━━━━━━━━━━━━━━\n\n🇮🇳 *National Holidays:*\n📅 Jan 26 — Republic Day\n📅 Mar 14 — Holi\n📅 Apr 14 — Tamil New Year\n📅 May 01 — May Day\n📅 Aug 15 — Independence Day\n📅 Sep 07 — Vinayagar Chaturthi\n📅 Oct 02 — Gandhi Jayanti\n📅 Oct 12 — Dussehra\n📅 Nov 01 — Deepavali\n📅 Dec 25 — Christmas\n\n🏠 *PG Specific:*\n📅 Every Sunday — Common Area Cleaning Day\n📅 1st of Month — Rent Due Reminder\n\n━━━━━━━━━━━━━━━━━━━━\n_Holidays may include reduced mess/services. Plan accordingly!_`;
    await sendMessage(phone, holidayMsg);
}

// Handle Vacancy Rooms from Menu — show available rooms
async function handleMenuVacancy(phone) {
    try {
        const tenants = await sheetsService.getAllTenants();
        const locations = await sheetsService.getAllLocations();

        // Find occupied rooms
        const occupiedRooms = new Set();
        tenants.forEach(t => {
            if (t.get('Status') !== 'VACATED') {
                occupiedRooms.add(t.get('Room'));
            }
        });

        let vacancyMsg = `🛏️ *Available Rooms*\n━━━━━━━━━━━━━━━━━━━━\n\n`;

        if (locations && locations.length > 0) {
            locations.forEach(loc => {
                const locName = loc.name || loc.get?.('Name') || 'Location';
                const totalRooms = parseInt(loc.totalRooms || loc.get?.('Total Rooms') || 0);
                const locTenants = tenants.filter(t => {
                    const tLoc = t.get('Location') || '';
                    return tLoc === locName && t.get('Status') !== 'VACATED';
                });
                const occupied = locTenants.length;
                const available = Math.max(0, totalRooms - occupied);
                vacancyMsg += `📍 *${locName}*\n   Total Rooms: ${totalRooms}\n   Occupied: ${occupied}\n   🟢 Available: ${available}\n\n`;
            });
        } else {
            const totalActive = tenants.filter(t => t.get('Status') !== 'VACATED').length;
            vacancyMsg += `📍 *${config.businessName}*\n   🏠 Active Tenants: ${totalActive}\n   🟢 Rooms maybe available — Contact admin for details\n\n`;
        }

        vacancyMsg += `━━━━━━━━━━━━━━━━━━━━\n📞 Contact admin for booking!`;
        await sendButtons(phone, vacancyMsg, ['📞 Contact']);
    } catch (err) {
        console.error('Vacancy check error:', err.message);
        await sendMessage(phone, `🛏️ *Vacancy Rooms*\n\nPlease contact the admin to check room availability.`);
        await sendButtons(phone, 'Contact admin for room availability:', ['📞 Contact']);
    }
}

// Handle Refer a Friend from Menu
async function handleMenuRefer(phone) {
    const tenant = await sheetsService.getTenantByPhone(phone);
    const tenantName = tenant ? tenant.get('Name') : 'there';
    const regUrl = config.googleFormUrl || 'https://forms.gle/YOUR_FORM_ID';
    const referLink = `${regUrl}?ref=${encodeURIComponent(phone)}`;

    const referMsg = `👥 *Refer a Friend*\n━━━━━━━━━━━━━━━━━━━━\n\nHi *${tenantName}*! 🎉\n\nKnow someone looking for a great PG?\nRefer them to *${config.businessName}* and help them find a comfortable home!\n\n📲 *Share this registration link:*\n${referLink}\n\n🎁 *Referral Benefits:*\n• Your friend gets smooth onboarding\n• You may receive special discounts!\n\n━━━━━━━━━━━━━━━━━━━━\n_Share the link with your friends via WhatsApp!_`;

    await sendCTAButton(
        phone,
        referMsg,
        '📤 Share Registration Link',
        referLink,
        '👥 Refer a Friend'
    );
}

// Handle Statement for a specific month
async function handleStatementMonth(phone, year, month) {
    const tenant = await sheetsService.getTenantByPhone(phone);
    if (!tenant || tenant.get('Status') === 'VACATED') {
        await sendMessage(phone, `You are not registered. Type *HI* to start.`);
        return;
    }

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthLabel = `${monthNames[month]} ${year}`;
    const name = tenant.get('Name');

    try {
        const paymentHistory = await sheetsService.getPaymentHistory(phone, 12);
        let found = null;

        if (paymentHistory && paymentHistory.length > 0) {
            found = paymentHistory.find(h => {
                const my = h.get('Month-Year') || '';
                return my.toLowerCase().includes(monthNames[month].toLowerCase()) && my.includes(year.toString());
            });
        }

        if (found) {
            const amount = found.get('Total Amount') || '0';
            const mode = found.get('Payment Mode') || 'N/A';
            const status = found.get('Status') || 'VALID';
            const trxId = found.get('Transaction ID') || 'N/A';
            const paidDate = found.get('Paid Date') || 'N/A';
            const rentAmt = found.get('Rent Amount') || tenant.get('Monthly Rent') || '0';
            const ebAmt = found.get('EB Amount') || tenant.get('EB Amount') || '0';

            const isVerified = status === 'PAID' || status === 'VALID';
            const stmtMsg = `\ud83d\udcdc *Payment Statement*\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n\ud83d\udcc5 *Month: ${monthLabel}*\n\ud83d\udc64 Name: ${name}\n\ud83d\udeaa Room: ${tenant.get('Room') || 'N/A'}\n\n\ud83d\udcb0 *Breakdown:*\n\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\u2502 \ud83c\udfe0 Rent: \u20b9${rentAmt}\n\u2502 \u26a1 EB: \u20b9${ebAmt}\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\ud83d\udcb5 *Total: \u20b9${amount}*\n\n\ud83d\udcb3 Mode: ${mode}\n\ud83d\udd16 TXN ID: ${trxId}\n\ud83d\udcc5 Paid: ${paidDate}\n${isVerified ? '\u2705' : '\u23f3'} Status: *${status}*\n\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`;
            await sendMessage(phone, stmtMsg);
        } else {
            // Check old history format
            const oldHistory = await sheetsService.getHistoryByPhone(phone);
            const oldFound = oldHistory.find(h => {
                const m = (h.get('Month') || '').toLowerCase();
                const y = h.get('Year') || '';
                return m === monthNames[month].toLowerCase() && y.toString() === year.toString();
            });

            if (oldFound) {
                const amount = oldFound.get('Amount') || '0';
                const mode = oldFound.get('Mode') || 'N/A';
                const stmtMsg = `\ud83d\udcdc *Payment Statement*\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n\ud83d\udcc5 *Month: ${monthLabel}*\n\ud83d\udc64 Name: ${name}\n\n\ud83d\udcb5 *Total Paid: \u20b9${amount}*\n\ud83d\udcb3 Mode: ${mode}\n\u2705 Status: *VALID*\n\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`;
                await sendMessage(phone, stmtMsg);
            } else {
                const noDataMsg = `\ud83d\udcdc *Payment Statement*\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n\ud83d\udcc5 *Month: ${monthLabel}*\n\ud83d\udc64 Name: ${name}\n\n\u274c No payment record found for this month.\n\n_If you believe this is an error, please contact the admin._\n\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`;
                await sendButtons(phone, noDataMsg, ['\ud83d\udcde Contact']);
            }
        }
    } catch (err) {
        console.error('Statement fetch error:', err.message);
        await sendMessage(phone, `Unable to fetch statement for ${monthLabel}. Please try again later.`);
    }
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
    // Only send to those who haven't paid yet (ACTIVE). 
    // If PENDING, they already submitted and are waiting for verification.
    const toBill = tenants.filter(t => t.get('Status') === 'ACTIVE' || !t.get('Status'));
    for (const t of toBill) {
        await handleIncomingMessage(t.get('Phone'), 'RENT');
        await new Promise(r => setTimeout(r, 2000));
    }
    await sendMessage(ownerPhone, `Sent billing info to ${toBill.length} residents.`);
}

async function handleSendReminder(ownerPhone) {
    const tenants = await sheetsService.getAllTenants();
    const pending = tenants.filter(t => t.get('Status') !== 'PAID' && t.get('Status') !== 'VALID' && t.get('Status') !== 'VACATED');
    for (const t of pending) {
        await sendMessage(t.get('Phone'), `🔔 *Payment Reminder*\nFriendly reminder to pay your dues. Type RENT to see details.`);
        await new Promise(r => setTimeout(r, 1000));
    }
    await sendMessage(ownerPhone, `Sent reminders to ${pending.length} residents.`);
}

// ==================== ADMIN VERIFICATION FUNCTIONS ====================

// Admin verifies a manual UPI or Cash payment → Generate Invoice + Mark VALID
async function handleVerifyPayment(ownerPhone, tenantPhone) {
    const cleanPhone = normalizePhone(tenantPhone);
    const details = await sheetsService.verifyPayment(cleanPhone);
    if (!details) {
        await sendMessage(ownerPhone, `❌ Tenant not found for phone: ${tenantPhone}`);
        return;
    }

    const { name, room, amount, mode: paymentMode, trxId, date: pDate } = details;
    const tenant = await sheetsService.getTenantByPhone(cleanPhone);
    const rent = parseFloat(tenant.get('Monthly Rent') || 0);
    const eb = parseFloat(tenant.get('EB Amount') || 0);

    // Generate Invoice PDF
    const { filePath } = await pdfService.generateInvoice({
        Name: name, Phone: cleanPhone, Room: room,
        EB_Amount: eb.toString(), Monthly_Rent: rent.toString(), Total_Amount: amount.toString(),
        Paid_Date: pDate, Transaction_ID: trxId, Payment_Mode: paymentMode
    });

    // Send invoice to tenant
    await sendMessage(cleanPhone, `✅ *Payment Verified & Confirmed!*\n\nHi ${name},\n\n📋 *Breakdown:*\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n💰 *Total Paid: ₹${amount}*\n\n💳 Mode: ${paymentMode}\n🔖 TXN ID: ${trxId}\n📅 Date: ${pDate}\n\nYour invoice is attached below. Thank you! 🙏`);
    await sendMedia(cleanPhone, filePath, '📄 Your payment receipt', null, 'StayFlow_Invoice.pdf');

    // Confirm to owner
    await sendMessage(ownerPhone, `✅ *Payment Verified*\nTenant: ${name}\nRoom: ${room}\nMode: ${paymentMode}\nAmount: ₹${amount}\nTXN: ${trxId}\n\nStatus: VALID\n📄 Invoice sent to tenant.`);
}

// Admin rejects a payment → Mark as INVALID, notify tenant
async function handleRejectPayment(ownerPhone, tenantPhone) {
    const cleanPhone = normalizePhone(tenantPhone);
    const tenant = await sheetsService.getTenantByPhone(cleanPhone);
    if (!tenant) {
        await sendMessage(ownerPhone, `❌ Tenant not found for phone: ${tenantPhone}`);
        return;
    }

    const name = tenant.get('Name');
    const room = tenant.get('Room') || 'N/A';
    const trxId = tenant.get('Transaction ID') || 'N/A';

    // Update sheet via unified rejectPayment method
    await sheetsService.rejectPayment(cleanPhone);

    // Notify tenant
    await sendMessage(cleanPhone, `❌ *Payment Rejected*\n\nHi ${name},\n\nYour submitted payment (TXN: ${trxId}) could not be verified.\n\n⚠️ Please try again with a valid payment.\nType *PAID* to restart the payment process.\n\nIf you believe this is an error, please contact admin.`);

    // Confirm to owner
    await sendMessage(ownerPhone, `❌ *Payment Rejected*\nTenant: ${name}\nRoom: ${room}\nTXN: ${trxId}\nStatus: INVALID\n\n_No invoice generated._`);
}

// ==================== RAZORPAY PAYMENT VERIFICATION ====================

// Called when Razorpay webhook or confirmation page verifies successful payment
async function handleRazorpaySuccess(phone, amount, trxId, paymentMode = 'UPI (Razorpay)', extraDetails = {}) {
    const cleanPhone = normalizePhone(phone);
    const tenant = await sheetsService.getTenantByPhone(cleanPhone);
    if (!tenant) {
        console.error(`Razorpay success but tenant not found: ${phone}`);
        return;
    }

    const name = tenant.get('Name');
    const room = tenant.get('Room') || 'N/A';
    const rent = parseFloat(tenant.get('Monthly Rent') || 0);
    const eb = parseFloat(tenant.get('EB Amount') || 0);
    const total = amount || (rent + eb);

    // Check if already marked as PAID to avoid duplicate processing
    if (tenant.get('Status') === 'PAID' && tenant.get('Transaction ID') === trxId) {
        console.log(`Payment already processed for ${name} [${trxId}]`);
        return;
    }

    // Mark as PAID (auto-verified by Razorpay)
    await sheetsService.updateTenant(cleanPhone, {
        'Status': 'PAID',
        'Payment Mode': paymentMode,
        'Transaction ID': trxId,
        'Paid Date': new Date().toLocaleDateString()
    });

    // Log to History and Payments sheets
    await sheetsService.logPayment(tenant, total.toString(), paymentMode, trxId, 'PAID');

    // Generate Invoice PDF
    const { filePath } = await pdfService.generateInvoice({
        Name: name, Phone: cleanPhone, Room: room,
        EB_Amount: eb.toString(), Monthly_Rent: rent.toString(), Total_Amount: total.toString(),
        Paid_Date: new Date().toLocaleDateString(), Transaction_ID: trxId, Payment_Mode: paymentMode,
        UPI_ID: extraDetails.vpa || '',
        Payment_ID: extraDetails.payment_id || trxId,
        Order_ID: extraDetails.order_id || ''
    });

    // Send to tenant via WhatsApp
    await sendMessage(cleanPhone, `✅ *Payment Successful via UPI!*\n\nHi ${name},\n\n📋 *Breakdown:*\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n💰 *Total Paid: ₹${total}*\n\n💳 Mode: UPI\n🔖 TXN ID: ${trxId}\n📅 Date: ${new Date().toLocaleDateString()}\n\nThank you for choosing StayFlow! 🙏`);
    await sendMedia(cleanPhone, filePath, '📄 Your payment receipt', null, 'StayFlow_Invoice.pdf');

    // Notify owner
    if (config.ownerPhone) {
        await sendMessage(config.ownerPhone, `✅ *UPI Payment — Verified*\nTenant: ${name}\nRoom: ${room}\nAmount: ₹${total}\nTXN: ${trxId}\nStatus: PAID\n\n📄 Invoice sent automatically.`);
    }
}

async function handleOnboarding(phone, input, image) {
    const state = userState[phone];
    switch (state.step) {

        // ========== PAYMENT FLOW STATES ==========
        case 'PAYMENT_METHOD': {
            const choice = input.trim().toUpperCase();
            const isRazorpay = choice.includes('PAY VIA RAZORPAY') || choice.includes('RAZORPAY') || choice.includes('PAY NOW UPI') || choice.includes('UPI');
            const isCash = choice.includes('PAY CASH') || (choice.includes('CASH') && !choice.includes('VERIFY'));
            const isCancel = choice.includes('CANCEL');

            if (isCancel) {
                await sendMessage(phone, '❌ Payment cancelled. Type *RENT* anytime to view your bill.');
                delete userState[phone];
            } else if (isRazorpay) {
                const tenant = await sheetsService.getTenantByPhone(phone, state.contextName);
                if (!tenant) { await sendMessage(phone, 'Tenant not found.'); delete userState[phone]; return; }
                const rent = parseFloat(tenant.get('Monthly Rent') || 0);
                const eb = parseFloat(tenant.get('EB Amount') || 0);
                const total = rent + eb;

                const razorpayLink = await createRazorpayLink(phone, tenant.get('Name'), total, tenant.get('Room'));

                let msg = `💳 *Secure Payment (Razorpay)*\n\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Total: ₹${total}*\n\n_Redirecting to secure gateway..._`;

                if (razorpayLink) {
                    await sendCTAButton(phone, msg, '💳 Pay Now', razorpayLink, '💳 Secure Payment');
                } else {
                    await sendMessage(phone, `❌ Online payment is currently unavailable. Please contact admin.`);
                }
                delete userState[phone];
            } else if (isCash) {
                const tenant = await sheetsService.getTenantByPhone(phone, state.contextName);
                if (!tenant) { await sendMessage(phone, 'Tenant not found.'); delete userState[phone]; return; }
                const rent = parseFloat(tenant.get('Monthly Rent') || 0);
                const eb = parseFloat(tenant.get('EB Amount') || 0);
                const total = rent + eb;
                state.step = 'CASH_AMOUNT';
                state.expectedTotal = total;

                await sendMessage(phone, `💵 *Cash Payment*\n\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Total Due (Rent + EB): ₹${total}*\n\nPlease enter the *exact amount paid*.\nExample: *${total}*\n\n⚠️ _Invoice will be generated after admin verification._`);
            } else {
                await sendButtons(phone, '❌ Please select a payment method:', ["💳 Pay via Razorpay", "💵 Pay Cash", "❌ Cancel"]);
            }
            break;
        }

        case 'CASH_AMOUNT': {
            const amount = parseFloat(input.replace(/[^0-9.]/g, ''));
            if (isNaN(amount) || amount <= 0) {
                await sendMessage(phone, '❌ Please enter a valid number (e.g., 6500).');
                return;
            }
            state.amountPaid = amount;
            state.step = 'CASH_DATE';
            await sendMessage(phone, `📅 *Step 2: Date of Payment*\n\nPlease enter the date you paid cash (e.g., *Today*).`);
            break;
        }

        case 'CASH_DATE': {
            const pDate = input.trim();
            const tenant = await sheetsService.getTenantByPhone(phone, state.contextName);
            if (!tenant) { delete userState[phone]; return; }

            const rent = parseFloat(tenant.get('Monthly Rent') || 0);
            const eb = parseFloat(tenant.get('EB Amount') || 0);
            const trxId = `CASH-${Date.now().toString().slice(-6)}`;

            await sheetsService.updateTenant(phone, {
                'Status': 'PENDING', 'Payment Mode': 'CASH',
                'Transaction ID': trxId, 'Paid Date': pDate
            }, state.contextName);
            await sheetsService.logPayment(tenant, state.amountPaid.toString(), 'CASH', trxId, 'PENDING');

            await sendMessage(phone, `⏳ *Cash Payment Submitted*\n\nHi ${tenant.get('Name')},\n\n📋 *Breakdown:*\n🏠 Rent: ₹${rent}\n⚡ EB: ₹${eb}\n💰 *Amount Paid: ₹${state.amountPaid}*\n\n💵 Mode: CASH\n🔖 Ref: ${trxId}\n📅 Date: ${pDate}\n\n⚠️ _Your payment is pending admin verification. Invoice will be sent after confirmation._ 🙏`);

            if (config.ownerPhone) {
                await sendMessage(config.ownerPhone, `💵 *Cash Payment — Needs Verification*\nTenant: ${tenant.get('Name')}\nPhone: ${phone}\nRoom: ${tenant.get('Room')}\nRent: ₹${rent} | EB: ₹${eb}\nAmount: ₹${state.amountPaid}\nRef: ${trxId}\nDate: ${pDate}\n\n✅ Reply: *VERIFY CASH ${phone}*`);
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
    sendListMessage,
    sendCTAButton,
    sendButtons,
    createRazorpayLink,
    setTenantContext,
    handleUpdateEB,
    handleRazorpaySuccess
};
