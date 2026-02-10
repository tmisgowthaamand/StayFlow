import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// jspdf-autotable usually monkey-patches jsPDF or adds it as a plugin
// In ESM, we might need a specific way to call it depending on the version
// If it's the standard import, we can try:
import autoTable from 'jspdf-autotable';

class PDFService {
    async generateInvoice(tenantData) {
        const doc = new jsPDF();
        const { Name, Phone, Room, EB_Amount, Monthly_Rent, Total_Amount, Paid_Date, Transaction_ID, Payment_Mode } = tenantData;

        // Header
        doc.setFillColor(41, 128, 185);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text(config.businessName, 20, 25);
        doc.setFontSize(10);
        doc.text('Payment Receipt & Invoice', 20, 32);

        // Invoice Details
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(12);
        doc.text(`Receipt No: SF-${Date.now().toString().slice(-6)}`, 140, 55);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, 62);

        doc.setFontSize(14);
        doc.text('Bill To:', 20, 55);
        doc.setFontSize(11);
        doc.text(`Name: ${Name}`, 20, 62);
        doc.text(`Phone: ${Phone}`, 20, 68);
        doc.text(`Room: ${Room}`, 20, 74);

        // Table
        autoTable(doc, {
            startY: 85,
            head: [['Description', 'Amount']],
            body: [
                ['Monthly Rent', `INR ${Monthly_Rent}`],
                ['Electricity Bill', `INR ${EB_Amount}`],
            ],
            foot: [['Total Paid', `INR ${Total_Amount}`]],
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185] },
            footStyles: { fillColor: [41, 128, 185] },
        });

        // Verification Info
        const finalY = doc.lastAutoTable.finalY + 20;
        doc.setFontSize(10);
        doc.text(`Payment Method: ${Payment_Mode || 'UPI / Cash'}`, 20, finalY);
        doc.text(`Transaction ID: ${Transaction_ID}`, 20, finalY + 7);
        doc.text(`Paid Date: ${Paid_Date}`, 20, finalY + 14);

        // Footer
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text('This is a computer-generated receipt and does not require a physical signature.', 105, 280, { align: 'center' });
        doc.text(`Thank you for staying with ${config.businessName}!`, 105, 285, { align: 'center' });

        const fileName = `invoice_${Phone}_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../uploads', fileName);

        const buffer = Buffer.from(doc.output('arraybuffer'));
        fs.writeFileSync(filePath, buffer);

        return { fileName, filePath };
    }

    async generateRegistrationForm(tenantData) {
        const doc = new jsPDF();
        const { name, phone, room, sharingType, advance, monthlyRent } = tenantData;

        // Header
        doc.setFillColor(44, 62, 80);
        doc.rect(0, 0, 210, 45, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.text(config.businessName, 20, 25);
        doc.setFontSize(12);
        doc.text('New Resident Registration Form', 20, 35);

        // Registration Info
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(14);
        doc.text('Resident Details', 20, 60);

        autoTable(doc, {
            startY: 65,
            body: [
                ['Full Name', name],
                ['Phone Number', phone],
                ['Assigned Room', room || 'Unassigned'],
                ['Sharing Type', sharingType || 'N/A'],
                ['Monthly Rent', `INR ${monthlyRent || 'TBD'}`],
                ['Advance Paid', `INR ${advance || '0'}`],
                ['Registration Date', new Date().toLocaleDateString()],
            ],
            theme: 'grid',
            styles: { fontSize: 11, cellPadding: 5 },
            columnStyles: { 0: { fontStyle: 'bold', width: 60 } },
        });

        // PG Rules Section
        const rulesY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(14);
        doc.text('PG House Rules & Regulations', 20, rulesY);

        doc.setFontSize(10);
        const rules = [
            '1. Maintain cleanliness in rooms and common areas.',
            '2. Silence must be observed after 10:00 PM.',
            '3. Rent due by 5th, EB by 10th of every month.',
            '4. 30-day notice period required before vacating.',
            '5. No smoking, alcohol, or illegal substances on premises.',
            '6. Visitors must leave by 9:00 PM unless permitted.',
            '7. Heavy appliances (heaters/AC) require extra charges.',
            '8. PG property damage will be deductible from advance.',
        ];

        doc.setTextColor(100, 100, 100);
        let currentY = rulesY + 10;
        rules.forEach(rule => {
            doc.text(rule, 25, currentY);
            currentY += 7;
        });

        // Footer Disclaimer
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text('I hereby agree to abide by the rules and regulations of the PG.', 105, 270, { align: 'center' });
        doc.text('This is a digital copy for your records.', 105, 275, { align: 'center' });
        doc.text(config.businessName, 105, 280, { align: 'center' });

        const fileName = `registration_${phone}_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../uploads', fileName);

        const buffer = Buffer.from(doc.output('arraybuffer'));
        fs.writeFileSync(filePath, buffer);

        return { fileName, filePath };
    }
}

export default new PDFService();
