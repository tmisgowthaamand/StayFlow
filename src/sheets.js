import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from './config.js';
import { Tenant } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SheetsService {
    constructor() {
        this.doc = null;
        this.sheet = null;
        this.historySheet = null;
        this.locationsSheet = null;
        this.ebBillsSheet = null;
        this.paymentsSheet = null;
        this.notificationsLog = null;
    }

    normalizePhone(phone) {
        if (!phone) return '';
        let clean = phone.toString().replace(/\D/g, '');
        if (clean.length === 10) clean = '91' + clean;
        return clean;
    }

    async init() {
        if (this.doc && this.sheet) return;

        if (!config.sheets.id) {
            throw new Error('GOOGLE_SHEET_ID is missing in the configuration.');
        }

        let authConfig;
        const serviceAccountPath = join(__dirname, '../service-account.json');

        if (fs.existsSync(serviceAccountPath)) {
            console.log('Using service-account.json for authentication');
            try {
                const creds = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
                authConfig = {
                    email: creds.client_email,
                    key: creds.private_key,
                };
            } catch (jsonErr) {
                console.error('Failed to parse service-account.json:', jsonErr.message);
                throw new Error(`Corrupted service-account.json: ${jsonErr.message}`);
            }
        } else if (config.sheets.email && config.sheets.key) {
            console.log('Using environment variables for Google Sheets authentication');
            authConfig = {
                email: config.sheets.email,
                key: config.sheets.key,
            };
        } else {
            throw new Error('Google Sheets credentials not found. Provide service-account.json or set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY environment variables.');
        }

        // Extremely thorough key cleaning
        if (authConfig.key) {
            // Remove any potential surrounding quotes (sometimes happens in env vars)
            authConfig.key = authConfig.key.replace(/^["']|["']$/g, '');

            // Handle escaped newlines - sometimes they get double escaped as \\n
            authConfig.key = authConfig.key.replace(/\\n/g, '\n');

            // If the key is still a single line without newlines, it's definitely wrong
            if (!authConfig.key.includes('\n')) {
                console.warn('WARNING: Private key has no newlines. This will likely fail.');
            }

            authConfig.key = authConfig.key.trim();
        }

        console.log('Auth Email:', authConfig.email);
        console.log('Key length:', authConfig.key?.length);
        if (authConfig.key) {
            console.log('Key start:', authConfig.key.substring(0, 30));
            console.log('Key end:', authConfig.key.substring(authConfig.key.length - 30));
        }

        const serviceAccountAuth = new JWT({
            email: authConfig.email,
            key: authConfig.key,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive.file'
            ],
        });

        console.log('Initializing Google Sheets Service...');
        try {
            this.doc = new GoogleSpreadsheet(config.sheets.id, serviceAccountAuth);
            await this.doc.loadInfo();
            console.log(`Google Sheets Loaded Successfully: ${this.doc.title}`);
        } catch (err) {
            this.doc = null;
            console.error('Google Sheets Init FAILED (loadInfo):', err.message);
            if (err.message.includes('Signature') || err.message.includes('grant')) {
                console.error('JWT Error Details:', err.response?.data);
                throw new Error(`Invalid JWT Connection: ${err.message}. Please verify the Private Key and Service Account Email.`);
            }
            throw err;
        }


        // ========== TENANTS SHEET ==========
        let sheet = this.doc.sheetsByTitle['Tenants'] ||
            Object.values(this.doc.sheetsByTitle).find(s => s.title.trim().toLowerCase() === 'tenants');

        console.log(`Available sheets: ${Object.keys(this.doc.sheetsByTitle).join(', ')}`);

        const requiredHeaders = [
            'Name', 'Phone', 'Room', 'Bed', 'Floor', 'Location', 'Sharing Type', 'Advance',
            'Aadhaar Image', 'Registration Form', 'Monthly Rent', 'EB Amount', 'Total Amount',
            'Payment Mode', 'Transaction ID', 'Payment Proof',
            'Status', 'Join Date', 'Paid Date'
        ];

        if (!sheet) {
            console.log('No Tenants sheet found. Creating new one...');
            sheet = await this.doc.addSheet({
                title: 'Tenants',
                headerValues: requiredHeaders
            });
        } else {
            console.log(`Found sheet: ${sheet.title}`);
            await sheet.loadHeaderRow();
            console.log(`Current Headers: ${sheet.headerValues.join(', ')}`);

            // Check if Row 1 is data instead of headers
            if (sheet.headerValues.some(h => /\d{10}/.test(h) || h.toLowerCase() === 'ram')) {
                console.warn('CRITICAL: Header row seems to contain resident data (Ram/Phone)! Please insert a header row at the top.');
            }

            const missing = requiredHeaders.filter(h => !sheet.headerValues.includes(h));
            if (missing.length > 0) {
                console.log(`Adding missing headers: ${missing.join(', ')}`);
                await sheet.setHeaderRow([...sheet.headerValues, ...missing]);
            }
        }
        if (!sheet) {
            throw new Error('Tenants sheet not found and could not be created.');
        }
        this.sheet = sheet;

        // ========== HISTORY SHEET ==========
        let historySheet = this.doc.sheetsByTitle['History'];
        const historyHeaders = ['Name', 'Phone', 'Room', 'Month', 'Year', 'Amount', 'Mode', 'TRX_ID', 'Date'];
        if (!historySheet) {
            historySheet = await this.doc.addSheet({
                title: 'History',
                headerValues: historyHeaders
            });
        }
        this.historySheet = historySheet;

        // ========== LOCATIONS SHEET ==========
        let locationsSheet = this.doc.sheetsByTitle['Locations'];
        const locationsHeaders = [
            'Location Name', 'Address', 'Total Rooms', 'Floors',
            'Occupied', 'Unoccupied', 'Total Beds', 'Occupied Beds', 'Notes'
        ];
        if (!locationsSheet) {
            locationsSheet = await this.doc.addSheet({
                title: 'Locations',
                headerValues: locationsHeaders
            });
            // Add default location
            await locationsSheet.addRow({
                'Location Name': 'Main Branch',
                'Address': 'Address Here',
                'Total Rooms': '10',
                'Floors': '2',
                'Occupied': '0',
                'Unoccupied': '10',
                'Total Beds': '40',
                'Occupied Beds': '0',
                'Notes': 'Default location'
            });
        }
        this.locationsSheet = locationsSheet;

        // ========== EB_BILLS SHEET ==========
        let ebBillsSheet = this.doc.sheetsByTitle['EB_Bills'];
        const ebBillsHeaders = [
            'Month-Year', 'Location', 'Total Units', 'Rate Per Unit',
            'Calculated Total EB', 'Entry Date', 'Notes'
        ];
        if (!ebBillsSheet) {
            ebBillsSheet = await this.doc.addSheet({
                title: 'EB_Bills',
                headerValues: ebBillsHeaders
            });
        }
        this.ebBillsSheet = ebBillsSheet;

        // ========== PAYMENTS SHEET ==========
        let paymentsSheet = this.doc.sheetsByTitle['Payments'];
        const paymentsHeaders = [
            'Phone', 'Name', 'Room', 'Month-Year', 'Rent Amount', 'EB Amount',
            'Total Amount', 'Payment Mode', 'Transaction ID', 'Payment Proof',
            'Paid Date', 'Status', 'Location'
        ];
        if (!paymentsSheet) {
            paymentsSheet = await this.doc.addSheet({
                title: 'Payments',
                headerValues: paymentsHeaders
            });
        }
        this.paymentsSheet = paymentsSheet;

        // ========== NOTIFICATIONS_LOG SHEET ==========
        let notificationsLog = this.doc.sheetsByTitle['Notifications_Log'];
        const notificationsHeaders = [
            'Phone', 'Name', 'Message Type', 'Sent Date', 'Content', 'Status'
        ];
        if (!notificationsLog) {
            notificationsLog = await this.doc.addSheet({
                title: 'Notifications_Log',
                headerValues: notificationsHeaders
            });
        }
        this.notificationsLog = notificationsLog;
    }

    // ==================== TENANT METHODS ====================

    async logPayment(tenant, amount, mode, trxId, status = 'PAID') {
        await this.init();
        const date = new Date();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        // Log to History ONLY if it's VALID/PAID
        if (status === 'VALID' || status === 'PAID') {
            await this.historySheet.addRow({
                'Name': tenant.get('Name'),
                'Phone': tenant.get('Phone'),
                'Room': tenant.get('Room'),
                'Month': monthNames[date.getMonth()],
                'Year': date.getFullYear(),
                'Amount': amount,
                'Mode': mode,
                'TRX_ID': trxId,
                'Date': date.toLocaleDateString()
            });
        }

        // Also log to Payments sheet
        const monthYear = `${monthNames[date.getMonth()]}-${date.getFullYear()}`;
        await this.paymentsSheet.addRow({
            'Phone': tenant.get('Phone'),
            'Name': tenant.get('Name'),
            'Room': tenant.get('Room') || 'N/A',
            'Month-Year': monthYear,
            'Rent Amount': tenant.get('Monthly Rent') || '0',
            'EB Amount': tenant.get('EB Amount') || '0',
            'Total Amount': amount,
            'Payment Mode': mode,
            'Transaction ID': trxId,
            'Paid Date': date.toLocaleDateString(),
            'Status': status,
            'Location': tenant.get('Location') || 'Main Branch'
        });
    }

    async verifyPayment(phone) {
        await this.init();
        const tenant = await this.getTenantByPhone(phone);
        if (!tenant) return false;

        const currentMonthYear = `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][new Date().getMonth()]}-${new Date().getFullYear()}`;

        // 1. Find Pending Payment in Payments Sheet
        const pRows = await this.paymentsSheet.getRows();
        const pRow = pRows.find(r => r.get('Phone') === phone && r.get('Status') === 'PENDING');

        let trxId = tenant.get('Transaction ID');
        let amount = tenant.get('Total Amount') || '0';
        let mode = tenant.get('Payment Mode') || 'UPI (Manual)';
        let pDate = tenant.get('Paid Date') || new Date().toLocaleDateString();

        if (pRow) {
            trxId = pRow.get('Transaction ID') || trxId;
            amount = pRow.get('Total Amount') || amount;
            mode = pRow.get('Payment Mode') || mode;
            pDate = pRow.get('Paid Date') || pDate;

            pRow.set('Status', 'PAID');
            await pRow.save();
        }

        // 2. Update Tenant Status in main sheet
        tenant.set('Status', 'PAID');
        tenant.set('Transaction ID', trxId);
        tenant.set('Paid Date', pDate);
        await tenant.save();

        // 3. Sync to MongoDB
        await this._syncToMongo(phone);

        // 4. Add to History (if not already there)
        const hRows = await this.historySheet.getRows();
        const exists = hRows.some(r => r.get('TRX_ID') === trxId && trxId !== 'PENDING');
        if (!exists && trxId) {
            await this.historySheet.addRow({
                'Name': tenant.get('Name'),
                'Phone': tenant.get('Phone'),
                'Room': tenant.get('Room'),
                'Month': ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][new Date().getMonth()],
                'Year': new Date().getFullYear(),
                'Amount': amount,
                'Mode': mode,
                'TRX_ID': trxId,
                'Date': pDate
            });
        }

        return {
            name: tenant.get('Name'),
            room: tenant.get('Room'),
            amount: amount,
            mode: mode,
            trxId: trxId,
            date: pDate
        };
    }

    async rejectPayment(phone) {
        await this.init();
        const tenant = await this.getTenantByPhone(phone);
        if (!tenant) return false;

        const trxId = tenant.get('Transaction ID');

        // 1. Update Payments Sheet record
        if (trxId) {
            const rows = await this.paymentsSheet.getRows();
            const row = rows.find(r => r.get('Transaction ID') === trxId);
            if (row) {
                row.set('Status', 'INVALID');
                await row.save();
            }
        }

        // 2. Update Tenant Status
        tenant.set('Status', 'INVALID');
        await tenant.save();

        // 3. Sync to MongoDB
        await this._syncToMongo(phone);

        return true;
    }

    async getHistoryByPhone(phone) {
        await this.init();
        const rows = await this.historySheet.getRows();
        const cleanTarget = phone.toString().replace(/\D/g, '');
        return rows.filter(row => {
            const rowPhone = (row.get('Phone') || '').toString().replace(/\D/g, '');
            return rowPhone === cleanTarget || (rowPhone.length >= 10 && cleanTarget.slice(-10) === rowPhone.slice(-10));
        });
    }

    async getPaymentHistory(phone, limit = 3) {
        await this.init();
        const rows = await this.paymentsSheet.getRows();
        const cleanTarget = phone.toString().replace(/\D/g, '');

        const matching = rows.filter(row => {
            const rowPhone = (row.get('Phone') || '').toString().replace(/\D/g, '');
            return rowPhone === cleanTarget ||
                (rowPhone.length >= 10 && cleanTarget.length >= 10 &&
                    rowPhone.slice(-10) === cleanTarget.slice(-10));
        });

        // Sort by date descending and take last N
        matching.sort((a, b) => {
            const dateA = new Date(a.get('Paid Date') || '1970-01-01');
            const dateB = new Date(b.get('Paid Date') || '1970-01-01');
            return dateB - dateA;
        });

        return matching.slice(0, limit);
    }

    async getTenantByPhone(phone, name = null) {
        if (!phone) return null;
        await this.init();
        const rows = await this.sheet.getRows();
        const cleanTarget = phone.toString().replace(/\D/g, '');

        return rows.find(row => {
            const rowPhone = (row.get('Phone') || '').toString().replace(/\D/g, '');
            const rowName = (row.get('Name') || '').trim();
            const phoneMatch = (rowPhone === cleanTarget) ||
                (rowPhone.length >= 10 && cleanTarget.length >= 10 &&
                    rowPhone.slice(-10) === cleanTarget.slice(-10));

            if (name) {
                return phoneMatch && rowName.toLowerCase() === name.trim().toLowerCase();
            }
            return phoneMatch;
        });
    }

    async addTenant(tenantData) {
        await this.init();
        console.log('Attempting to add tenant:', tenantData.name);
        const rowData = {
            'Name': tenantData.name,
            'Phone': tenantData.phone,
            'Room': tenantData.room,
            'Bed': tenantData.bed || 'N/A',
            'Floor': tenantData.floor || '1',
            'Sharing Type': tenantData.sharingType,
            'Location': tenantData.location || 'Main Branch',
            'Advance': tenantData.advance,
            'Aadhaar Image': tenantData.aadhaarImage || '',
            'Registration Form': tenantData.registrationForm || '',
            'Monthly Rent': tenantData.monthlyRent,
            'EB Amount': '0',
            'Total Amount': tenantData.monthlyRent,
            'Status': 'ACTIVE',
            'Join Date': new Date().toLocaleDateString(),
        };
        try {
            const row = await this.sheet.addRow(rowData);
            console.log('Successfully added row for:', tenantData.name);

            // Update location occupancy
            await this.updateLocationOccupancy(tenantData.location || 'Main Branch');

            // Auto-sync new tenant to MongoDB
            await this._syncToMongo(tenantData.phone, tenantData.name);

            return row;
        } catch (err) {
            console.error('Error in addRow:', err.message);
            throw err;
        }
    }

    // ==================== MONGODB SYNC HELPER ====================
    // Auto-syncs a tenant's data from Google Sheets → MongoDB
    async _syncToMongo(phone, name = null) {
        try {
            const tenant = await this.getTenantByPhone(phone, name);
            if (!tenant) return;

            await Tenant.findOneAndUpdate(
                { phone: tenant.get('Phone'), name: tenant.get('Name') },
                {
                    room: tenant.get('Room') || '',
                    bed: tenant.get('Bed') || '',
                    floor: tenant.get('Floor') || '',
                    location: tenant.get('Location') || '',
                    sharingType: tenant.get('Sharing Type') || '',
                    advance: tenant.get('Advance') || '',
                    monthlyRent: tenant.get('Monthly Rent') || '',
                    ebAmount: tenant.get('EB Amount') || '',
                    totalAmount: tenant.get('Total Amount') || '',
                    status: tenant.get('Status') || '',
                    joinDate: tenant.get('Join Date') || '',
                    paidDate: tenant.get('Paid Date') || '',
                    aadhaarImage: tenant.get('Aadhaar Image') || ''
                },
                { upsert: true, new: true }
            );
            console.log(`[SHEETS→MONGO] Synced: ${tenant.get('Name')} (${phone})`);
        } catch (err) {
            console.error(`[SHEETS→MONGO] Sync failed for ${phone}:`, err.message);
        }
    }

    // Full sync: ALL tenants from Sheets → MongoDB
    async syncAllToMongo() {
        try {
            const tenants = await this.getTenantsJSON();
            let count = 0;
            for (const t of tenants) {
                if (!t.Phone) continue;
                await Tenant.findOneAndUpdate(
                    { phone: t.Phone, name: t.Name },
                    {
                        room: t.Room || '', bed: t.Bed || '', floor: t.Floor || '',
                        location: t.Location || '', sharingType: t['Sharing Type'] || '',
                        advance: t.Advance || '', monthlyRent: t['Monthly Rent'] || '',
                        ebAmount: t['EB Amount'] || '', totalAmount: t['Total Amount'] || '',
                        status: t.Status || '', joinDate: t['Join Date'] || '',
                        paidDate: t['Paid Date'] || '', aadhaarImage: t['Aadhaar Image'] || ''
                    },
                    { upsert: true, new: true }
                );
                count++;
            }
            console.log(`[SHEETS→MONGO] Full sync complete: ${count} tenants`);
            return count;
        } catch (err) {
            console.error('[SHEETS→MONGO] Full sync failed:', err.message);
            return 0;
        }
    }

    async updateTenant(phone, updates, name = null) {
        const row = await this.getTenantByPhone(phone, name);
        if (row) {
            Object.keys(updates).forEach(key => {
                row.set(key, updates[key]);
            });
            await row.save();

            // Auto-sync to MongoDB
            await this._syncToMongo(phone, name);

            return true;
        }
        return false;
    }

    async getAllTenants() {
        await this.init();
        return await this.sheet.getRows();
    }

    async getTenantsJSON() {
        await this.init();
        const rows = await this.sheet.getRows();
        return rows.map(row => {
            const data = {};
            this.sheet.headerValues.forEach(header => {
                data[header] = row.get(header) || '';
            });
            return data;
        });
    }

    async getTenantsByLocation(location) {
        await this.init();
        const rows = await this.sheet.getRows();
        return rows.filter(row => {
            const rowLocation = row.get('Location') || 'Main Branch';
            return rowLocation.toLowerCase() === location.toLowerCase();
        });
    }

    async deleteTenant(phone, name) {
        await this.init();
        const row = await this.getTenantByPhone(phone, name);
        if (row) {
            const location = row.get('Location') || 'Main Branch';
            await row.delete();
            // Update location occupancy
            await this.updateLocationOccupancy(location);
            return true;
        }
        return false;
    }

    // ==================== LOCATION METHODS ====================

    async getAllLocations() {
        await this.init();
        const rows = await this.locationsSheet.getRows();
        return rows.map(row => ({
            name: row.get('Location Name') || '',
            address: row.get('Address') || '',
            totalRooms: parseInt(row.get('Total Rooms') || '0'),
            floors: parseInt(row.get('Floors') || '1'),
            occupied: parseInt(row.get('Occupied') || '0'),
            unoccupied: parseInt(row.get('Unoccupied') || '0'),
            totalBeds: parseInt(row.get('Total Beds') || '0'),
            occupiedBeds: parseInt(row.get('Occupied Beds') || '0'),
            notes: row.get('Notes') || ''
        }));
    }

    async addLocation(locationData) {
        await this.init();
        await this.locationsSheet.addRow({
            'Location Name': locationData.name,
            'Address': locationData.address || '',
            'Total Rooms': locationData.totalRooms || '10',
            'Floors': locationData.floors || '1',
            'Occupied': '0',
            'Unoccupied': locationData.totalRooms || '10',
            'Total Beds': locationData.totalBeds || '40',
            'Occupied Beds': '0',
            'Notes': locationData.notes || ''
        });
    }

    async updateLocationOccupancy(locationName) {
        await this.init();
        const tenants = await this.getTenantsByLocation(locationName);
        const activeCount = tenants.filter(t => t.get('Status') !== 'VACATED').length;

        const rows = await this.locationsSheet.getRows();
        const locationRow = rows.find(r =>
            (r.get('Location Name') || '').toLowerCase() === locationName.toLowerCase()
        );

        if (locationRow) {
            const totalBeds = parseInt(locationRow.get('Total Beds') || '40');
            locationRow.set('Occupied Beds', activeCount.toString());
            locationRow.set('Occupied', Math.ceil(activeCount / 4).toString()); // Estimate rooms
            locationRow.set('Unoccupied', Math.max(0, parseInt(locationRow.get('Total Rooms') || '10') - Math.ceil(activeCount / 4)).toString());
            await locationRow.save();
        }
    }

    // ==================== EB BILLS METHODS ====================

    async addEBBill(ebData) {
        await this.init();
        const totalEB = parseFloat(ebData.totalUnits) * parseFloat(ebData.ratePerUnit || config.ebUnitRate || 15);

        await this.ebBillsSheet.addRow({
            'Month-Year': ebData.monthYear,
            'Location': ebData.location || 'Main Branch',
            'Total Units': ebData.totalUnits,
            'Rate Per Unit': ebData.ratePerUnit || config.ebUnitRate || '15',
            'Calculated Total EB': totalEB.toString(),
            'Entry Date': new Date().toLocaleDateString(),
            'Notes': ebData.notes || ''
        });

        return { totalEB };
    }

    async getEBBillsByLocation(location) {
        await this.init();
        const rows = await this.ebBillsSheet.getRows();
        return rows.filter(row => {
            const rowLocation = row.get('Location') || 'Main Branch';
            return rowLocation.toLowerCase() === location.toLowerCase();
        }).map(row => ({
            monthYear: row.get('Month-Year'),
            location: row.get('Location'),
            totalUnits: row.get('Total Units'),
            ratePerUnit: row.get('Rate Per Unit'),
            calculatedTotalEB: row.get('Calculated Total EB'),
            entryDate: row.get('Entry Date')
        }));
    }

    async getCurrentMonthEB(location) {
        await this.init();
        const now = new Date();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const currentMonthYear = `${monthNames[now.getMonth()]}-${now.getFullYear()}`;

        const rows = await this.ebBillsSheet.getRows();
        return rows.find(row =>
            row.get('Month-Year') === currentMonthYear &&
            (row.get('Location') || 'Main Branch').toLowerCase() === (location || 'Main Branch').toLowerCase()
        );
    }

    // ==================== NOTIFICATIONS LOG METHODS ====================

    async logNotification(phone, name, messageType, content, status = 'SENT') {
        await this.init();
        await this.notificationsLog.addRow({
            'Phone': phone,
            'Name': name || '',
            'Message Type': messageType,
            'Sent Date': new Date().toISOString(),
            'Content': content.substring(0, 500), // Limit content length
            'Status': status
        });
    }

    async getNotificationsByPhone(phone, limit = 10) {
        await this.init();
        const rows = await this.notificationsLog.getRows();
        const cleanTarget = phone.toString().replace(/\D/g, '');

        const matching = rows.filter(row => {
            const rowPhone = (row.get('Phone') || '').toString().replace(/\D/g, '');
            return rowPhone === cleanTarget ||
                (rowPhone.length >= 10 && cleanTarget.slice(-10) === rowPhone.slice(-10));
        });

        return matching.slice(-limit).reverse();
    }

    // ==================== ANALYTICS METHODS ====================

    async getDashboardStats() {
        await this.init();
        const tenants = await this.sheet.getRows();
        const locations = await this.getAllLocations();

        const activeTenants = tenants.filter(t => t.get('Status') !== 'VACATED');
        const paidTenants = tenants.filter(t => t.get('Status') === 'VALID' || t.get('Status') === 'PAID');
        const pendingTenants = activeTenants.filter(t => t.get('Status') === 'PENDING');
        const unpaidTenants = activeTenants.filter(t => t.get('Status') === 'ACTIVE');

        // Calculate total revenue this month
        const now = new Date();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const currentMonth = monthNames[now.getMonth()];

        const history = await this.historySheet.getRows();
        const thisMonthPayments = history.filter(h =>
            h.get('Month') === currentMonth &&
            parseInt(h.get('Year')) === now.getFullYear()
        );

        const totalRevenueFromTenants = paidTenants.reduce((sum, t) =>
            sum + parseFloat((t.get('Total Amount') || '0').toString().replace(/[^\d.]/g, '')), 0
        );

        const totalRevenue = thisMonthPayments.length > 0
            ? thisMonthPayments.reduce((sum, h) => sum + parseFloat(h.get('Amount') || '0'), 0)
            : totalRevenueFromTenants; // Fallback to Tenants sheet if History is empty for the month

        // Expected revenue
        const expectedRevenue = activeTenants.reduce((sum, t) =>
            sum + parseFloat(t.get('Total Amount') || '0'), 0
        );

        return {
            totalTenants: activeTenants.length,
            paidCount: paidTenants.length,
            pendingCount: pendingTenants.length,
            unpaidCount: unpaidTenants.length,
            vacatedCount: tenants.filter(t => t.get('Status') === 'VACATED').length,
            totalRevenue,
            expectedRevenue,
            collectionPercentage: expectedRevenue > 0 ? Math.round((totalRevenue / expectedRevenue) * 100) : 0,
            locations: locations.map(loc => ({
                ...loc,
                tenantCount: activeTenants.filter(t => (t.get('Location') || 'Main Branch') === loc.name).length
            })),
            recentPayments: thisMonthPayments.slice(-5).reverse().map(h => ({
                name: h.get('Name'),
                amount: h.get('Amount'),
                mode: h.get('Mode'),
                date: h.get('Date')
            }))
        };
    }

    async getRoomMap(location = null) {
        await this.init();
        const tenants = await this.sheet.getRows();

        // Filter by location if specified
        const filteredTenants = location
            ? tenants.filter(t => (t.get('Location') || 'Main Branch').toLowerCase() === location.toLowerCase())
            : tenants;

        // Group by room
        const roomMap = {};
        filteredTenants.forEach(t => {
            if (t.get('Status') === 'VACATED') return;

            const room = t.get('Room') || 'Unknown';
            const floor = t.get('Floor') || '1';
            const sharing = parseInt(t.get('Sharing Type')) || 4;

            if (!roomMap[room]) {
                roomMap[room] = {
                    room,
                    floor,
                    capacity: sharing,
                    occupants: [],
                    location: t.get('Location') || 'Main Branch'
                };
            }

            roomMap[room].occupants.push({
                name: t.get('Name'),
                phone: t.get('Phone'),
                status: t.get('Status'),
                bed: t.get('Bed') || 'N/A'
            });
        });

        return Object.values(roomMap);
    }
}

export default new SheetsService();
