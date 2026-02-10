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

        const pageW = 210;
        const margin = 15;
        const contentW = pageW - margin * 2;

        // Color palette (olive/dark green theme matching the reference image)
        const olive = [107, 114, 87];       // #6B7257 - primary accent
        const oliveDark = [85, 91, 69];     // #555B45 - darker shade
        const oliveLight = [142, 149, 126]; // #8E957E - lighter shade
        const textDark = [40, 40, 40];
        const textMid = [100, 100, 100];
        const bgLight = [245, 244, 240];    // light warm gray

        const invoiceNo = `SF-${Date.now().toString().slice(-6)}`;
        const invoiceDate = new Date().toLocaleDateString('en-IN');
        const now = new Date();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const billingMonth = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

        // ==================== TITLE ====================
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(...textDark);
        doc.text('BILLING INVOICE', margin, 22);

        // Thin olive line under title
        doc.setDrawColor(...olive);
        doc.setLineWidth(0.8);
        doc.line(margin, 26, pageW - margin, 26);

        // ==================== COMPANY INFO (left) ====================
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...textDark);
        doc.text(config.businessName, margin, 35);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...textMid);
        const ownerPhone = config.ownerPhone || Phone;
        doc.text(`Phone: ${ownerPhone}`, margin, 40);
        doc.text(`UPI: ${config.upiId || 'N/A'}`, margin, 45);

        // ==================== INVOICE META BOX (right) ====================
        const metaX = 130;
        const metaW = 65;

        // Invoice No row
        doc.setFillColor(...olive);
        doc.rect(metaX, 29, metaW / 2, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text('INVOICE NO.', metaX + 1.5, 34);

        doc.setFillColor(...bgLight);
        doc.rect(metaX + metaW / 2, 29, metaW / 2, 7, 'F');
        doc.setTextColor(...textDark);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(invoiceNo, metaX + metaW / 2 + 2, 34);

        // Date row
        doc.setFillColor(...olive);
        doc.rect(metaX, 36, metaW / 2, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text('DATE', metaX + 1.5, 41);

        doc.setFillColor(...bgLight);
        doc.rect(metaX + metaW / 2, 36, metaW / 2, 7, 'F');
        doc.setTextColor(...textDark);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(invoiceDate, metaX + metaW / 2 + 2, 41);

        // Billing Month row
        doc.setFillColor(...olive);
        doc.rect(metaX, 43, metaW / 2, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text('BILLING MONTH', metaX + 1.5, 48);

        doc.setFillColor(...bgLight);
        doc.rect(metaX + metaW / 2, 43, metaW / 2, 7, 'F');
        doc.setTextColor(...textDark);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(billingMonth, metaX + metaW / 2 + 2, 48);

        // Payment Terms row
        doc.setFillColor(...olive);
        doc.rect(metaX, 50, metaW / 2, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text('TERMS', metaX + 1.5, 55);

        doc.setFillColor(...bgLight);
        doc.rect(metaX + metaW / 2, 50, metaW / 2, 7, 'F');
        doc.setTextColor(...textDark);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Due by ${config.rentDueDate}th`, metaX + metaW / 2 + 2, 55);

        // ==================== BILL TO (left) & PROPERTY (right) ====================
        const sectionY = 65;

        // BILL TO label
        doc.setFillColor(...olive);
        doc.rect(margin, sectionY, 30, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text('BILL TO:', margin + 1.5, sectionY + 4.5);

        // BILL TO details
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...textDark);
        doc.text(Name, margin, sectionY + 13);
        doc.setTextColor(...textMid);
        doc.setFontSize(8.5);
        doc.text(`Phone: ${Phone}`, margin, sectionY + 18);

        // PROPERTY label
        doc.setFillColor(...olive);
        doc.rect(metaX, sectionY, 35, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text('PROPERTY:', metaX + 1.5, sectionY + 4.5);

        // PROPERTY details
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...textDark);
        doc.text(`Room: ${Room}`, metaX, sectionY + 13);
        doc.setTextColor(...textMid);
        doc.setFontSize(8.5);
        doc.text(`Payment: ${Payment_Mode || 'Pending'}`, metaX, sectionY + 18);
        if (Transaction_ID && Transaction_ID !== 'PENDING') {
            doc.text(`TXN: ${Transaction_ID}`, metaX, sectionY + 23);
        }

        // ==================== ITEMS TABLE ====================
        const rent = parseFloat(Monthly_Rent) || 0;
        const eb = parseFloat(EB_Amount) || 0;
        const total = parseFloat(Total_Amount) || (rent + eb);

        const tableBody = [
            ['Monthly Room Rent', '1', `${rent.toFixed(2)}`, `${rent.toFixed(2)}`],
            ['Electricity Bill (EB)', '1', `${eb.toFixed(2)}`, `${eb.toFixed(2)}`],
        ];

        // Add empty rows to match the reference image style
        for (let i = 0; i < 5; i++) {
            tableBody.push(['', '', '', '']);
        }

        autoTable(doc, {
            startY: 95,
            head: [['DESCRIPTION', 'QTY', 'UNIT PRICE', 'AMOUNT']],
            body: tableBody,
            theme: 'plain',
            styles: {
                fontSize: 8.5,
                cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
                lineColor: [200, 200, 195],
                lineWidth: 0.3,
                textColor: textDark,
            },
            headStyles: {
                fillColor: olive,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 7.5,
                halign: 'left',
            },
            columnStyles: {
                0: { cellWidth: 90 },
                1: { cellWidth: 20, halign: 'center' },
                2: { cellWidth: 35, halign: 'right' },
                3: { cellWidth: 35, halign: 'right' },
            },
            alternateRowStyles: {
                fillColor: [250, 249, 245],
            },
            didParseCell: (data) => {
                // Add ₹ symbol to price columns for non-empty rows
                if ((data.column.index === 2 || data.column.index === 3) && data.section === 'body') {
                    const val = data.cell.raw?.toString().trim();
                    if (val && val !== '' && val !== '0.00') {
                        data.cell.text = [`₹  ${val}`];
                    }
                }
            },
        });

        // ==================== SUBTOTAL & TOTAL ====================
        const tableEndY = doc.lastAutoTable.finalY;

        // Subtotal row
        const subX = margin + 90 + 20; // After description + qty columns
        doc.setDrawColor(...oliveLight);
        doc.setLineWidth(0.3);
        doc.line(subX, tableEndY + 2, pageW - margin, tableEndY + 2);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...textDark);
        doc.text('SUBTOTAL', subX + 2, tableEndY + 8);
        doc.text(`₹`, pageW - margin - 38, tableEndY + 8);
        doc.text(`${total.toFixed(2)}`, pageW - margin - 2, tableEndY + 8, { align: 'right' });

        // Total row with olive background
        doc.setFillColor(...olive);
        doc.rect(subX, tableEndY + 12, contentW - 90 - 20, 9, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text('TOTAL', subX + 2, tableEndY + 18);
        doc.text(`₹`, pageW - margin - 38, tableEndY + 18);
        doc.text(`${total.toFixed(2)}`, pageW - margin - 2, tableEndY + 18, { align: 'right' });

        // ==================== PAYMENT STATUS BOX ====================
        const statusY = tableEndY + 28;
        if (Paid_Date && Paid_Date !== 'PENDING') {
            doc.setFillColor(232, 245, 233);
            doc.roundedRect(margin, statusY, contentW, 14, 2, 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(46, 125, 50);
            doc.text(`✓  PAID on ${Paid_Date}  |  Mode: ${Payment_Mode}  |  TXN: ${Transaction_ID}`, margin + 5, statusY + 9);
        } else {
            doc.setFillColor(255, 243, 224);
            doc.roundedRect(margin, statusY, contentW, 14, 2, 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(230, 126, 34);
            doc.text(`⏳  PAYMENT PENDING  |  Due by ${config.rentDueDate}th of this month`, margin + 5, statusY + 9);
        }

        // ==================== THANK YOU ====================
        const tyY = statusY + 25;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(...oliveLight);
        doc.text('THANK YOU', margin, tyY);

        // ==================== FOOTER ====================
        doc.setDrawColor(...oliveLight);
        doc.setLineWidth(0.4);
        doc.line(margin, 268, pageW - margin, 268);

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(...textMid);
        doc.text('For questions concerning this invoice, please contact', pageW / 2, 274, { align: 'center' });
        doc.text(`${config.businessName}, ${config.ownerPhone || 'N/A'}, UPI: ${config.upiId || 'N/A'}`, pageW / 2, 279, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...olive);
        doc.text('This is a computer-generated invoice. No signature required.', pageW / 2, 286, { align: 'center' });

        // ==================== SAVE ====================
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
