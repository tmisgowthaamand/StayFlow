const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const config = require('./config');

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

    async init() {
        if (this.doc) return;

        const creds = require('../service-account.json');
        const serviceAccountAuth = new JWT({
            email: creds.client_email,
            key: creds.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        console.log('Initializing Google Sheets Service...');
        this.doc = new GoogleSpreadsheet(config.sheets.id, serviceAccountAuth);
        await this.doc.loadInfo();
        console.log('Google Sheets Loaded Successfully.');

        // ========== TENANTS SHEET ==========
        let sheet = this.doc.sheetsByTitle['Tenants'];
        const requiredHeaders = [
            'Name', 'Phone', 'Room', 'Bed', 'Floor', 'Location', 'Sharing Type', 'Advance',
            'Aadhaar Image', 'Monthly Rent', 'EB Amount', 'Total Amount',
            'Payment Mode', 'Transaction ID', 'Payment Proof',
            'Status', 'Join Date', 'Paid Date'
        ];

        if (!sheet) {
            sheet = await this.doc.addSheet({
                title: 'Tenants',
                headerValues: requiredHeaders
            });
        } else {
            await sheet.loadHeaderRow();
            const missing = requiredHeaders.filter(h => !sheet.headerValues.includes(h));
            if (missing.length > 0) {
                console.log(`Adding missing headers: ${missing.join(', ')}`);
                await sheet.setHeaderRow([...sheet.headerValues, ...missing]);
            }
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
            'Phone', 'Name', 'Month-Year', 'Rent Amount', 'EB Amount',
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

    async logPayment(tenant, amount, mode, trxId) {
        await this.init();
        const date = new Date();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        // Log to History (backward compatibility)
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

        // Also log to Payments sheet
        const monthYear = `${monthNames[date.getMonth()]}-${date.getFullYear()}`;
        await this.paymentsSheet.addRow({
            'Phone': tenant.get('Phone'),
            'Name': tenant.get('Name'),
            'Month-Year': monthYear,
            'Rent Amount': tenant.get('Monthly Rent') || '0',
            'EB Amount': tenant.get('EB Amount') || '0',
            'Total Amount': amount,
            'Payment Mode': mode,
            'Transaction ID': trxId,
            'Paid Date': date.toLocaleDateString(),
            'Status': 'PAID',
            'Location': tenant.get('Location') || 'Main Branch'
        });
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

            return row;
        } catch (err) {
            console.error('Error in addRow:', err.message);
            throw err;
        }
    }

    async updateTenant(phone, updates, name = null) {
        const row = await this.getTenantByPhone(phone, name);
        if (row) {
            Object.keys(updates).forEach(key => {
                row.set(key, updates[key]);
            });
            await row.save();
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
        const paidTenants = tenants.filter(t => t.get('Status') === 'PAID');
        const pendingTenants = activeTenants.filter(t => t.get('Status') !== 'PAID');

        // Calculate total revenue this month
        const now = new Date();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const currentMonth = monthNames[now.getMonth()];

        const history = await this.historySheet.getRows();
        const thisMonthPayments = history.filter(h =>
            h.get('Month') === currentMonth &&
            parseInt(h.get('Year')) === now.getFullYear()
        );

        const totalRevenue = thisMonthPayments.reduce((sum, h) =>
            sum + parseFloat(h.get('Amount') || '0'), 0
        );

        // Expected revenue
        const expectedRevenue = activeTenants.reduce((sum, t) =>
            sum + parseFloat(t.get('Total Amount') || '0'), 0
        );

        return {
            totalTenants: activeTenants.length,
            paidCount: paidTenants.length,
            pendingCount: pendingTenants.length,
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

module.exports = new SheetsService();
