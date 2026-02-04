const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

class WWebEngine {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process', // <- This one helps on some shared hosting
                    '--disable-gpu'
                ],
            }
        });

        this.ready = false;
    }

    init() {
        this.client.on('qr', (qr) => {
            console.log('SCAN THIS QR CODE FOR WHATSAPP:');
            qrcode.generate(qr, { small: true });
        });

        this.client.on('ready', () => {
            console.log('WhatsApp Web Client is READY!');
            this.ready = true;
        });

        this.client.on('message', async (msg) => {
            const { handleIncomingMessage } = require('./bot');
            const phone = msg.from.replace('@c.us', '');
            const body = msg.body;
            const hasMedia = msg.hasMedia;

            // Simple media handling for Aadhaar/Payments
            let media = null;
            if (hasMedia) {
                const download = await msg.downloadMedia();
                const fileName = `wweb_${Date.now()}.${download.mimetype.split('/')[1]}`;
                const filePath = path.join(__dirname, '../uploads', fileName);
                fs.writeFileSync(filePath, download.data, { encoding: 'base64' });
                media = { id: fileName, mimetype: download.mimetype };
            }

            await handleIncomingMessage(phone, body, msg.id.id, media);
        });

        this.client.initialize();
    }

    async sendMessage(to, text) {
        let cleanTo = to.toString().replace(/\D/g, '');
        if (cleanTo.length === 10) cleanTo = '91' + cleanTo;
        const chatId = cleanTo.includes('@c.us') ? cleanTo : `${cleanTo}@c.us`;

        if (this.ready) {
            try {
                await this.client.sendMessage(chatId, text);
                console.log(`Msg sent via WWeb: ${chatId}`);
            } catch (e) {
                console.error('WWeb Send Message Error:', e);
            }
        } else {
            console.error('WWeb not ready');
        }
    }

    async sendImage(to, filePath, caption = '') {
        let cleanTo = to.toString().replace(/\D/g, '');
        if (cleanTo.length === 10) cleanTo = '91' + cleanTo;
        const chatId = cleanTo.includes('@c.us') ? cleanTo : `${cleanTo}@c.us`;

        console.log(`Sending Image via WWeb to: ${chatId} | File: ${filePath}`);

        if (this.ready) {
            if (fs.existsSync(filePath)) {
                try {
                    const media = MessageMedia.fromFilePath(filePath);
                    await this.client.sendMessage(chatId, media, { caption });
                    console.log('Image sent successfully');
                } catch (e) {
                    console.error('WWeb Send Image Error:', e);
                    throw e; // Bubble up to fallback
                }
            } else {
                console.error('File path does not exist:', filePath);
                throw new Error('File not found');
            }
        } else {
            console.error('WWeb Client not ready yet');
            throw new Error('Client not ready');
        }
    }
}

module.exports = new WWebEngine();
