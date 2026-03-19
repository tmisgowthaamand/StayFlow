import axios from 'axios';
import config from './config.js';

// Keep-alive service to prevent Render from sleeping
class KeepAliveService {
    constructor() {
        this.interval = null;
        this.pingInterval = 14 * 60 * 1000; // 14 minutes (Render free tier sleeps after 15 min)
        this.renderUrl = process.env.RENDER_API_URL || config.renderApiUrl;
    }

    start() {
        if (!this.renderUrl) {
            console.log('⚠️ RENDER_API_URL not configured. Keep-alive disabled.');
            return;
        }

        console.log(`✅ Keep-alive service started. Pinging ${this.renderUrl} every 14 minutes.`);
        
        // Ping immediately on start
        this.ping();
        
        // Then ping every 14 minutes
        this.interval = setInterval(() => {
            this.ping();
        }, this.pingInterval);
    }

    async ping() {
        try {
            const response = await axios.get(`${this.renderUrl}/api/wake`, {
                timeout: 10000
            });
            console.log(`[KEEP-ALIVE] ✅ Ping successful at ${new Date().toISOString()} | Uptime: ${response.data.uptime}s`);
        } catch (error) {
            console.error(`[KEEP-ALIVE] ❌ Ping failed: ${error.message}`);
            // Fallback to health endpoint
            try {
                await axios.get(`${this.renderUrl}/health`, { timeout: 10000 });
                console.log(`[KEEP-ALIVE] ✅ Fallback health check successful`);
            } catch (fallbackError) {
                console.error(`[KEEP-ALIVE] ❌ Fallback also failed: ${fallbackError.message}`);
            }
        }
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            console.log('Keep-alive service stopped.');
        }
    }
}

export default new KeepAliveService();
