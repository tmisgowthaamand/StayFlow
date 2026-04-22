import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WWebEngine {
    constructor() {
        this.ready = false;
        this.client = null;
        this.disabled = false;
    }

    init() {
        try {
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
                        '--single-process',
                        '--disable-gpu'
                    ],
                }
            });

            this.client.on('qr', (qr) => {
                console.log('SCAN THIS QR CODE FOR WHATSAPP:');
                qrcode.generate(qr, { small: true });
            });

            this.client.on('ready', () => {
                console.log('✅ WhatsApp Web Client is READY!');
                this.ready = true;
            });

            this.client.on('message', async (msg) => {
                // Dynamic import to avoid circular dependency at top level
                const { handleIncomingMessage } = await import('./bot.js');
                const phone = msg.from.replace('@c.us', '');
                const body = msg.body;
                const hasMedia = msg.hasMedia;

                let media = null;
                if (hasMedia) {
                    try {
                        const download = await msg.downloadMedia();
                        if (download) {
                            const fileName = `wweb_${Date.now()}.${download.mimetype.split('/')[1] || 'jpg'}`;
                            const filePath = path.join(__dirname, '../uploads', fileName);
                            fs.writeFileSync(filePath, download.data, { encoding: 'base64' });
                            media = { id: fileName, mimetype: download.mimetype };
                        }
                    } catch (err) {
                        console.error('Error downloading wweb media:', err.message);
                    }
                }

                await handleIncomingMessage(phone, body, msg.id.id, media);
            });

            this.client.initialize();
        } catch (err) {
            console.warn('⚠️ WhatsApp Web.js disabled (Chrome not found). Using Cloud API only.');
            this.disabled = true;
            this.ready = false;
        }
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
                    throw e;
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

export default new WWebEngine();
