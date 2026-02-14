import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import sheetsService from './sheets.js';
import * as bot from './bot.js';
import config from './config.js';
import { exportAllData } from './db.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Requirement 8: Monetary precision helper
const toPaise = (val) => {
    if (!val) return 0;
    const clean = val.toString().replace(/[^\d.]/g, '');
    return Math.round(parseFloat(clean) * 100);
};

function setupCron() {
    // 1. Send Bill on the 1st of every month at 9:00 AM
    cron.schedule('0 9 1 * *', async () => {
        console.log('Running Monthly Bill Cron...');
        try {
            const tenants = await sheetsService.getAllTenants();
            for (const tenant of tenants) {
                if (tenant.get('Status') === 'VACATED') continue;

                const phone = tenant.get('Phone');
                const name = tenant.get('Name');
                const rentPaise = toPaise(tenant.get('Monthly Rent'));
                const ebPaise = toPaise(tenant.get('EB Amount'));
                const totalPaise = rentPaise + ebPaise;
                const total = totalPaise / 100;

                const upiLink = `upi://pay?pa=${config.upiId}&pn=${encodeURIComponent(config.businessName)}&am=${total}&cu=INR`;
                const razorpayLink = await bot.createRazorpayLink(phone, name, total, tenant.get('Room'));

                let msg = `🚀 *STAYFLOW: New Monthly Bill*\n\nHi ${name},\nYour bill for the new month has been generated:\n\nRent: ₹${rentPaise / 100}\nEB: ₹${ebPaise / 100}\nTotal: ₹${total}\n\nDue Date: ${config.rentDueDate}th`;

                if (razorpayLink) {
                    msg += `\n\n💳 *Pay Online:* ${razorpayLink}`;
                }
                msg += `\n\n👇 *Pay via UPI:*\n${upiLink}`;

                await bot.sendMessage(phone, msg);
            }
        } catch (err) {
            console.error('Cron Error (1st):', err);
        }
    });

    // 2. Send Reminder on the 3rd of every month
    cron.schedule('0 9 3 * *', async () => {
        console.log('Running 3rd Day Reminder Cron...');
        try {
            const tenants = await sheetsService.getAllTenants();
            const unpaid = tenants.filter(t => t.get('Status') !== 'PAID' && t.get('Status') !== 'VACATED');

            for (const tenant of unpaid) {
                const phone = tenant.get('Phone');
                const name = tenant.get('Name');
                const totalPaise = toPaise(tenant.get('Total Amount'));
                const total = totalPaise / 100;
                const razorpayLink = await bot.createRazorpayLink(phone, name, total, tenant.get('Room'));

                let msg = `🔔 *Friendly Reminder*\n\nHi ${name}, your rent payment of *₹${total}* is due by the ${config.rentDueDate}th.`;

                if (razorpayLink) {
                    msg += `\n\n💳 *Pay Online Now:* ${razorpayLink}`;
                }

                msg += `\n\nIf you have already paid, please ignore this or send the transaction ID.`;
                await bot.sendMessage(phone, msg);
            }
        } catch (err) {
            console.error('Cron Error (3rd):', err);
        }
    });

    // 3. Final Reminder on the 5th of every month
    cron.schedule('0 9 5 * *', async () => {
        console.log('Running 5th Day Final Reminder Cron...');
        try {
            const tenants = await sheetsService.getAllTenants();
            const unpaid = tenants.filter(t => t.get('Status') !== 'PAID' && t.get('Status') !== 'VACATED');

            for (const tenant of unpaid) {
                const phone = tenant.get('Phone');
                const name = tenant.get('Name');
                const totalPaise = toPaise(tenant.get('Total Amount'));
                const total = totalPaise / 100;
                const razorpayLink = await bot.createRazorpayLink(phone, name, total, tenant.get('Room'));

                let msg = `⚠️ *FINAL REMINDER*\n\nHi ${name}, today is the last date to pay your rent of *₹${total}* without late fees.`;

                if (razorpayLink) {
                    msg += `\n\n💳 *Clear Dues via Online:* ${razorpayLink}`;
                }

                msg += `\n\nPlease clear your dues immediately.`;
                await bot.sendMessage(phone, msg);
            }
        } catch (err) {
            console.error('Cron Error (5th):', err);
        }
    });

    // 4. Daily Database Backup at 3:00 AM (Requirement 10)
    cron.schedule('0 3 * * *', async () => {
        console.log('Running Daily Database Backup...');
        try {
            const backupData = await exportAllData();
            const backupDir = path.join(__dirname, '../backups');
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

            const fileName = `backup-${new Date().toISOString().split('T')[0]}.json`;
            fs.writeFileSync(path.join(backupDir, fileName), JSON.stringify(backupData, null, 2));
            console.log(`[BACKUP] Successfully saved to ${fileName}`);
        } catch (err) {
            console.error('Cron Error (Backup):', err.message);
        }
    });

    // 5. Full Sync with MongoDB every 6 hours
    cron.schedule('0 */6 * * *', async () => {
        console.log('Running Full MongoDB Sync Cron...');
        try {
            const count = await sheetsService.syncAllToMongo();
            console.log(`[CRON] Auto-sync complete: ${count} tenants synced.`);
        } catch (err) {
            console.error('Cron Error (Sync):', err.message);
        }
    });

    console.log('🕒 Automation System Active: Daily Backups (3AM), Sync (6h), and Bills (1,3,5th).');
}

export default setupCron;
