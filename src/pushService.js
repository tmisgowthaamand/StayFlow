import axios from 'axios';
import { PushToken } from './db.js';

/**
 * Helper to send push notifications to all registered admin devices
 */
export async function sendPushNotification(title, body, data = {}) {
    try {
        const tokens = await PushToken.find({});
        if (tokens.length === 0) {
            console.log('[PUSH] No registered tokens found.');
            return;
        }

        const messages = tokens.map(t => ({
            to: t.token,
            sound: 'default',
            title,
            body,
            data,
            priority: 'high',
            channelId: 'default'
        }));

        const response = await axios.post('https://exp.host/--/api/v2/push/send', messages, {
            headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            }
        });

        console.log(`[PUSH] Sent ${messages.length} notifications: ${title}`);
        return response.data;
    } catch (err) {
        const errorMsg = err.response?.data || err.message;
        console.error('[PUSH-ERROR]', errorMsg);

        // Log to MongoDB for visibility in dashboard logs
        try {
            const { Log } = await import('./db.js');
            await Log.create({
                phone: 'SYSTEM',
                action: 'PUSH_NOTIFICATION_ERROR',
                details: { title, error: errorMsg }
            });
        } catch (dbErr) { }
    }
}
