const sheetsService = require('./src/sheets');

async function seedInBatch() {
    try {
        console.log('🌱 Starting batch seeding...');
        await sheetsService.init();
        await sheetsService.sheet.loadHeaderRow();

        const tenants = [
            { name: "Arjun Sharma", phone: "919876543210", room: "101", sharingType: "Two Sharing", rent: 7000, advance: 3500, status: "PAID", date: "05/12/2025" },
            { name: "Priya Nair", phone: "919876543211", room: "201", sharingType: "One Sharing", rent: 9000, advance: 5000, status: "PAID", date: "10/12/2025" },
            { name: "Kartik Iyer", phone: "919876543212", room: "301", sharingType: "Three Sharing", rent: 6500, advance: 3000, status: "PAID", date: "15/12/2025" },
            { name: "Ananya Reddy", phone: "919876543213", room: "102", sharingType: "Two Sharing", rent: 7000, advance: 3500, status: "PAID", date: "20/12/2025" },
            { name: "Rohan Gupta", phone: "919876543214", room: "202", sharingType: "One Sharing", rent: 9000, advance: 9000, status: "PAID", date: "01/01/2026" },
            { name: "Sneha Rao", phone: "919876543215", room: "302", sharingType: "Three Sharing", rent: 6500, advance: 6500, status: "PENDING", date: "03/01/2026" },
            { name: "Rahul Deshmukh", phone: "919876543216", room: "103", sharingType: "Two Sharing", rent: 7000, advance: 3500, status: "PAID", date: "05/01/2026" },
            { name: "Meera Krishnan", phone: "919876543217", room: "203", sharingType: "Two Sharing", rent: 7000, advance: 7000, status: "PAID", date: "08/01/2026" },
            { name: "Vikram Singh", phone: "919876543218", room: "303", sharingType: "Three Sharing", rent: 6500, advance: 6500, status: "PENDING", date: "10/01/2026" },
            { name: "Pooja Verma", phone: "919876543219", room: "401", sharingType: "Four Sharing", rent: 6500, advance: 6500, status: "PAID", date: "12/01/2026" },
            { name: "Aditya Joshi", phone: "919876543220", room: "101", sharingType: "Two Sharing", rent: 7000, advance: 3500, status: "PAID", date: "15/01/2026" },
            { name: "Kavita Patil", phone: "919876543221", room: "204", sharingType: "One Sharing", rent: 9000, advance: 5000, status: "PENDING", date: "20/01/2026" },
            { name: "Suresh Kumar", phone: "919876543222", room: "301", sharingType: "Three Sharing", rent: 6500, advance: 3000, status: "PAID", date: "25/01/2026" },
            { name: "Deepa Menon", phone: "919876543223", room: "102", sharingType: "Two Sharing", rent: 7000, advance: 3500, status: "PENDING", date: "01/02/2026" },
            { name: "Manish Tiwari", phone: "919876543224", room: "205", sharingType: "One Sharing", rent: 9000, advance: 9000, status: "PAID", date: "01/02/2026" },
            { name: "Lakshmi Prabha", phone: "919876543225", room: "302", sharingType: "Three Sharing", rent: 6500, advance: 6500, status: "PENDING", date: "02/02/2026" },
            { name: "Sanjay Hegde", phone: "919876543226", room: "103", sharingType: "Two Sharing", rent: 7000, advance: 3500, status: "PAID", date: "02/02/2026" },
            { name: "Bhavna Jain", phone: "919876543227", room: "203", sharingType: "Two Sharing", rent: 7000, advance: 7000, status: "PAID", date: "02/02/2026" },
            { name: "Nitin Kumar", phone: "919876543228", room: "303", sharingType: "Three Sharing", rent: 6500, advance: 6500, status: "PENDING", date: "02/02/2026" },
            { name: "Swati Singh", phone: "919876543229", room: "401", sharingType: "Four Sharing", rent: 6500, advance: 6500, status: "PAID", date: "02/02/2026" }
        ];

        const rowsToAdd = tenants.map(t => ({
            'Name': t.name,
            'Phone': t.phone,
            'Room': t.room,
            'Sharing Type': t.sharingType,
            'Advance': t.advance.toString(),
            'Monthly Rent': t.rent.toString(),
            'EB Amount': '0',
            'Total Amount': t.rent.toString(),
            'Status': t.status,
            'Join Date': t.date,
            'Paid Date': t.status === 'PAID' ? t.date : ''
        }));

        console.log('Adding rows...');
        await sheetsService.sheet.addRows(rowsToAdd);
        console.log('🌿 Seeding complete!');
    } catch (err) {
        console.error('❌ Seeding failed:', err);
    }
}

seedInBatch();
