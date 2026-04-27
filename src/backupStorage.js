import { google } from 'googleapis';
import config from './config.js';

const auth = new google.auth.JWT(
    config.sheets.email,
    null,
    config.sheets.key,
    ['https://www.googleapis.com/auth/drive.file']
);

const drive = google.drive({ version: 'v3', auth });

export async function uploadBackup(fileName, data) {
    try {
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
