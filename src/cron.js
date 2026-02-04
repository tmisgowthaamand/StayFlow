const cron = require('node-cron');
const sheetsService = require('./sheets');
const bot = require('./bot');
const config = require('./config');

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
                const rent = tenant.get('Monthly Rent');
                const eb = tenant.get('EB Amount') || 0;
                const total = parseFloat(rent) + parseFloat(eb);

                const upiLink = `upi://pay?pa=${config.upiId}&pn=${encodeURIComponent(config.businessName)}&am=${total}&cu=INR`;
                const razorpayLink = await bot.createRazorpayLink(phone, name, total, tenant.get('Room'));

                let msg = `🚀 *STAYFLOW: New Monthly Bill*\n\nHi ${name},\nYour bill for the new month has been generated:\n\nRent: ₹${rent}\nEB: ₹${eb}\nTotal: ₹${total}\n\nDue Date: ${config.rentDueDate}th`;

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
                const total = parseFloat(tenant.get('Total Amount') || 0);
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
                const total = parseFloat(tenant.get('Total Amount') || 0);
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

    console.log('🕒 Automation System Active: Notifications scheduled for 1st, 3rd, and 5th.');
}

module.exports = setupCron;
