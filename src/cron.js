import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import sheetsService from './sheets.js';
import * as bot from './bot.js';
import config from './config.js';
import { exportAllData, Query } from './db.js';
import { fileURLToPath } from 'url';
import { uploadBackup } from './backupStorage.js';

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

                let msg = `🚀 *STAYFLOW: New Monthly Bill*\n━━━━━━━━━━━━━━━━━━━━\n\n👤 *Name*          :  ${name}\n\n🏠 *Rent*            :  ₹${rentPaise / 100}\n⚡ *EB*                :  ₹${ebPaise / 100}\n━━━━━━━━━━━━━━━━━━━━\n💵 *Total*            :  ₹${total}\n📅 *Due Date*    :  ${config.rentDueDate}th`;

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

                let msg = `🔔 *Friendly Reminder*\n━━━━━━━━━━━━━━━━━━━━\n\n👤 *Name*          :  ${name}\n💵 *Amount*      :  ₹${total}\n📅 *Due Date*    :  ${config.rentDueDate}th\n📌 *Status*          :  ⏳ PENDING\n━━━━━━━━━━━━━━━━━━━━`;

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

                let msg = `⚠️ *FINAL REMINDER*\n━━━━━━━━━━━━━━━━━━━━\n\n👤 *Name*          :  ${name}\n💵 *Amount*      :  ₹${total}\n📅 *Due Date*    :  ${config.rentDueDate}th (Today!)\n📌 *Status*          :  ❌ OVERDUE\n━━━━━━━━━━━━━━━━━━━━`;

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

    // 4. Overdue Reminder on the 10th at 9:00 AM
    cron.schedule('0 9 10 * *', async () => {
        console.log('Running 10th Day Overdue Reminder Cron...');
        try {
            const tenants = await sheetsService.getAllTenants();
            const unpaid = tenants.filter(t => {
                const s = t.get('Status');
                return s !== 'PAID' && s !== 'VALID' && s !== 'VACATED';
            });

            if (unpaid.length === 0) {
                console.log('[CRON 10th] All tenants paid. No reminders needed.');
                return;
            }

            // Send individual reminders
            for (const tenant of unpaid) {
                const phone = tenant.get('Phone');
                const name = tenant.get('Name');
                const room = tenant.get('Room');
                const totalPaise = toPaise(tenant.get('Total Amount'));
                const total = totalPaise / 100;
                const razorpayLink = await bot.createRazorpayLink(phone, name, total, room);

                let msg = `⚠️ *Rent Overdue — Day 10*\n━━━━━━━━━━━━━━━━━━━━\n\n👤 *Name*          :  ${name}\n🚪 *Room*          :  ${room}\n💵 *Amount*      :  ₹${total}\n📅 *Due Date*    :  ${config.rentDueDate}th (Overdue)\n📌 *Status*          :  ❌ OVERDUE\n━━━━━━━━━━━━━━━━━━━━\n_Please pay before 11th to avoid late fee._`;
                if (razorpayLink) msg += `\n\n💳 *Pay Now:* ${razorpayLink}`;
                msg += `\n\n💵 Or pay cash and inform admin.`;

                await bot.sendMessage(phone, msg);
                await new Promise(r => setTimeout(r, 1000));
            }

            // Send admin summary
            if (config.ownerPhone) {
                const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
                let summary = `📊 *Overdue Report — 10th ${currentMonth}*\n━━━━━━━━━━━━━━━━━━━━\n\n🔴 *${unpaid.length} tenant(s) have NOT paid:*\n\n`;
                let totalPending = 0;
                unpaid.forEach((t, i) => {
                    const amt = toPaise(t.get('Total Amount')) / 100;
                    totalPending += amt;
                    summary += `${i + 1}. ${t.get('Name')}  •  Room ${t.get('Room')}  •  ₹${amt}\n`;
                });
                summary += `\n━━━━━━━━━━━━━━━━━━━━\n💰 *Total Pending*  :  ₹${totalPending.toLocaleString()}\n━━━━━━━━━━━━━━━━━━━━\n_Reply *SEND REMINDER* to notify them all._`;
                await bot.sendMessage(config.ownerPhone, summary);
            }

            console.log(`[CRON 10th] Sent overdue reminders to ${unpaid.length} tenants + admin summary.`);
        } catch (err) {
            console.error('Cron Error (10th):', err);
        }
    });

    // 5. Final Overdue Warning on the 11th at 9:00 AM
    cron.schedule('0 9 11 * *', async () => {
        console.log('Running 11th Day Final Overdue Warning Cron...');
        try {
            const tenants = await sheetsService.getAllTenants();
            const unpaid = tenants.filter(t => {
                const s = t.get('Status');
                return s !== 'PAID' && s !== 'VALID' && s !== 'VACATED';
            });

            if (unpaid.length === 0) {
                console.log('[CRON 11th] All tenants paid.');
                return;
            }

            for (const tenant of unpaid) {
                const phone = tenant.get('Phone');
                const name = tenant.get('Name');
                const totalPaise = toPaise(tenant.get('Total Amount'));
                const total = totalPaise / 100;
                const razorpayLink = await bot.createRazorpayLink(phone, name, total, tenant.get('Room'));

                let msg = `🚨 *FINAL WARNING*\n━━━━━━━━━━━━━━━━━━━━\n\n👤 *Name*          :  ${name}\n💵 *Amount*      :  ₹${total}\n📌 *Status*          :  🚨 OVERDUE\n━━━━━━━━━━━━━━━━━━━━\n_This is your final reminder before late fee applies._\n_Please clear your dues immediately._`;
                if (razorpayLink) msg += `\n\n💳 *Pay Now:* ${razorpayLink}`;

                await bot.sendMessage(phone, msg);
                await new Promise(r => setTimeout(r, 1000));
            }

            // Admin update
            if (config.ownerPhone) {
                const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
                await bot.sendMessage(config.ownerPhone, `🚨 *11th ${currentMonth} — Final Warnings*\n━━━━━━━━━━━━━━━━━━━━\n\n📌 *Unpaid*        :  ${unpaid.length} tenant(s)\n📋 *Action*          :  Final warnings sent\n━━━━━━━━━━━━━━━━━━━━\n_Check dashboard for details._`);
            }

            console.log(`[CRON 11th] Sent final warnings to ${unpaid.length} tenants.`);
        } catch (err) {
            console.error('Cron Error (11th):', err);
        }
    });

    // 6. Daily Database Backup at 3:00 AM (Requirement 10)
    cron.schedule('0 3 * * *', async () => {
        console.log('Running Daily Database Backup...');
        try {
            const backupData = await exportAllData();
            const fileName = `backup-${new Date().toISOString().split('T')[0]}.json`;
            await uploadBackup(fileName, backupData);
            console.log(`[BACKUP] Successfully uploaded to Google Drive: ${fileName}`);
        } catch (err) {
            console.error('Cron Error (Backup):', err.message);
        }
    });

    // 7. Full Sync with MongoDB every 6 hours
    cron.schedule('0 */6 * * *', async () => {
        console.log('Running Full MongoDB Sync Cron...');
        try {
            const count = await sheetsService.syncAllToMongo();
            console.log(`[CRON] Auto-sync complete: ${count} tenants synced.`);
        } catch (err) {
            console.error('Cron Error (Sync):', err.message);
        }
    });

    // 8. Auto-reply to pending queries after 1 hour
    cron.schedule('*/30 * * * *', async () => {
        console.log('[CRON] Checking for unanswered queries (1hr auto-reply)...');
        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const pendingQueries = await Query.find({
                status: 'PENDING',
                autoReplySent: false,
                createdAt: { $lte: oneHourAgo }
            });

            if (pendingQueries.length === 0) {
                console.log('[CRON] No pending queries older than 1 hour.');
                return;
            }

            for (const query of pendingQueries) {
                await bot.sendMessage(query.phone, `🔔 *Query Update — #${query.queryId}*\n━━━━━━━━━━━━━━━━━━━━\n\n📝 *Issue*           :  "${query.message}"\n📌 *Status*         :  Accepted & Noted\n\n━━━━━━━━━━━━━━━━━━━━\nWe are working on it and will resolve it as soon as possible.\nThank you for your patience! 🙏`);
                query.autoReplySent = true;
                query.status = 'ACKNOWLEDGED';
                await query.save();
                await new Promise(r => setTimeout(r, 1000));
            }

            console.log(`[CRON] Auto-replied to ${pendingQueries.length} pending queries.`);
        } catch (err) {
            console.error('Cron Error (Query Auto-Reply):', err.message);
        }
    });

    console.log('🕒 Automation System Active: Bills (1,3,5th), Overdue (10,11th), Backups (3AM), Sync (6h), Query Auto-Reply (30min).');
}

export default setupCron;
