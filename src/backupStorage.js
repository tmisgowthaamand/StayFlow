import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function cleanPrivateKey(key) {
    return key?.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').trim();
}

function getBackupCredentials() {
    const serviceAccountPath = path.join(__dirname, '../service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
        const creds = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        return {
            email: creds.client_email,
            key: cleanPrivateKey(creds.private_key),
        };
    }

    return {
        email: config.sheets.email,
        key: cleanPrivateKey(config.sheets.key),
    };
}

async function getDriveClient() {
    const { email, key } = getBackupCredentials();
    if (!email || !key) {
        throw new Error('Google Drive backup credentials are missing.');
    }

    const auth = new google.auth.JWT({
        email,
        key,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    await auth.authorize();
    return google.drive({ version: 'v3', auth });
}

export async function uploadBackup(fileName, data) {
    try {
        const drive = await getDriveClient();
        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                mimeType: 'application/json'
            },
            media: {
                mimeType: 'application/json',
                body: JSON.stringify(data, null, 2)
            }
        });
        console.log(`[BACKUP] Uploaded to Drive: ${response.data.id} (${fileName})`);
        return response.data.id;
    } catch (error) {
        console.error('[BACKUP] Failed to upload to Drive:', error.message);
        throw error;
    }
}
