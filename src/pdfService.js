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
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            putOnlyUsedFonts: true
        });
        if (typeof doc.setCharSpace === 'function') doc.setCharSpace(0); // Reset character spacing to prevent ghosting
        // Color palette (Vibrant & Attractive - Modern Blue/Teal/Purple)
        const vPrimary = [79, 70, 229];      // #4F46E5 - Vibrant Indigo
        const vSecondary = [6, 182, 212];    // #06B6D4 - Electric Teal
        const vAccent = [139, 92, 246];      // #8B5CF6 - Soft Purple
        const textDark = [15, 23, 42];       // Slate Dark
        const textMid = [71, 85, 105];       // Slate Mid
        const bgLight = [248, 250, 252];    // Cool Gray light
        const white = [255, 255, 255];

        const { Name, Phone, Room, EB_Amount, Monthly_Rent, Total_Amount, Paid_Date, Transaction_ID, Payment_Mode } = tenantData;

        const pageW = 210;
        const margin = 15;
        const contentW = pageW - margin * 2;

        const invoiceNo = `SF-${Date.now().toString().slice(-6)}`;
        const invoiceDate = new Date().toLocaleDateString('en-IN');
        const now = new Date();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const billingMonth = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

        // ==================== VIBRANT BRANDING HEADER ====================
        // Vector Logo: House Shape
        doc.setDrawColor(...vPrimary);
        doc.setLineWidth(1);
        doc.setFillColor(...vPrimary);

        // Draw House Icon
        const lX = margin;
        const lY = 12;
        doc.line(lX, lY + 8, lX + 10, lY);
        doc.line(lX + 10, lY, lX + 20, lY + 8);
        doc.line(lX, lY + 8, lX + 20, lY + 8); // Floor
        doc.rect(lX + 4, lY + 8, 12, 10); // Base

        // Digital Flow 'S' (using robust straight lines)
        doc.setLineWidth(1.2);
        doc.setDrawColor(...vSecondary);
        doc.line(lX + 5, lY + 12, lX + 15, lY + 12);
        doc.line(lX + 15, lY + 12, lX + 15, lY + 16);
        doc.setDrawColor(...vAccent);
        doc.line(lX + 15, lY + 16, lX + 5, lY + 16);
        doc.line(lX + 5, lY + 16, lX + 5, lY + 20);
        doc.setDrawColor(...vSecondary);
        doc.line(lX + 5, lY + 20, lX + 15, lY + 20);

        doc.setFont('times', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(...vPrimary);
        doc.text("Stay", margin + 25, 20);
        doc.setTextColor(...vSecondary);
        doc.text("Flow", margin + 25 + 12, 20);

        doc.setFont('times', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...textMid);
        doc.text('PREMIUM PG MANAGEMENT', margin + 25, 24);

        // ==================== TITLE ====================
        doc.setFont('times', 'bold');
        doc.setFontSize(24);
        doc.setTextColor(...textDark);
        doc.text('BILLING INVOICE', margin, 42);

        // Colorful rainbow-like line under title
        doc.setLineWidth(1.2);
        doc.setDrawColor(...vPrimary);
        doc.line(margin, 46, margin + 60, 46);
        doc.setDrawColor(...vSecondary);
        doc.line(margin + 60, 46, margin + 120, 46);
        doc.setDrawColor(...vAccent);
        doc.line(margin + 120, 46, pageW - margin, 46);

        // ==================== COMPANY INFO (left) ====================
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...textDark);
        doc.text(String(config.businessName), margin, 55);

        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...textMid);
        const ownerPhone = config.ownerPhone || Phone;
        doc.text(`Phone: ${ownerPhone}`, margin, 60);
        doc.text(`UPI: ${config.upiId || 'N/A'}`, margin, 65);

        // ==================== INVOICE META BOX (right) ====================
        const metaX = 130;
        const metaW = 65;
        const metaYStart = 49;

        // Invoice No row
        doc.setFillColor(...vPrimary);
        doc.rect(metaX, metaYStart, metaW / 2, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text('INVOICE NO.', metaX + 1.5, metaYStart + 5);

        doc.setFillColor(...bgLight);
        doc.rect(metaX + metaW / 2, metaYStart, metaW / 2, 7, 'F');
        doc.setTextColor(...textDark);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(invoiceNo, metaX + metaW / 2 + 2, metaYStart + 5);

        // Date row
        doc.setFillColor(...vPrimary);
        doc.rect(metaX, metaYStart + 7, metaW / 2, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text('DATE', metaX + 1.5, metaYStart + 12);

        doc.setFillColor(...bgLight);
        doc.rect(metaX + metaW / 2, metaYStart + 7, metaW / 2, 7, 'F');
        doc.setTextColor(...textDark);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(invoiceDate, metaX + metaW / 2 + 2, metaYStart + 12);

        // Billing Month row
        doc.setFillColor(...vPrimary);
        doc.rect(metaX, metaYStart + 14, metaW / 2, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text('BILLING MONTH', metaX + 1.5, metaYStart + 19);

        doc.setFillColor(...bgLight);
        doc.rect(metaX + metaW / 2, metaYStart + 14, metaW / 2, 7, 'F');
        doc.setTextColor(...textDark);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(billingMonth, metaX + metaW / 2 + 2, metaYStart + 19);

        // Payment Terms row
        doc.setFillColor(...vPrimary);
        doc.rect(metaX, metaYStart + 21, metaW / 2, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text('TERMS', metaX + 1.5, metaYStart + 26);

        doc.setFillColor(...bgLight);
        doc.rect(metaX + metaW / 2, metaYStart + 21, metaW / 2, 7, 'F');
        doc.setTextColor(...textDark);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Due by ${config.rentDueDate}th`, metaX + metaW / 2 + 2, metaYStart + 26);

        // ==================== BILL TO (left) & PROPERTY (right) ====================
        const sectionY = 85; // Adjusted from 65 to 85 (shifted by 20)

        // BILL TO label
        doc.setFillColor(...vPrimary);
        doc.rect(margin, sectionY, 30, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text('BILL TO:', margin + 1.5, sectionY + 4.5);

        // BILL TO details
        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...textDark);
        doc.text(String(Name), margin, sectionY + 13);
        doc.setTextColor(...textMid);
        doc.setFontSize(8.5);
        doc.text("Phone: " + String(Phone), margin, sectionY + 18);

        // PROPERTY label
        doc.setFillColor(...vPrimary);
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

        const fmtCurrency = (val) => `Rs. ${val.toFixed(2)}`;

        const tableBody = [
            ['Monthly Room Rent', '1', fmtCurrency(rent), fmtCurrency(rent)],
            ['Electricity Bill (EB)', '1', fmtCurrency(eb), fmtCurrency(eb)],
        ];

        // Add empty rows to match the reference image style
        for (let i = 0; i < 5; i++) {
            tableBody.push(['', '', '', '']);
        }

        autoTable(doc, {
            startY: 105,
            head: [['DESCRIPTION', 'QTY', 'PRICE', 'AMOUNT']],
            body: tableBody,
            theme: 'plain',
            styles: {
                fontSize: 8.5,
                cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
                lineColor: [226, 232, 240],
                lineWidth: 0.1,
                textColor: textDark,
            },
            headStyles: {
                fillColor: vPrimary,
                textColor: white,
                fontStyle: 'bold',
                fontSize: 8,
                halign: 'center',
            },
            columnStyles: {
                0: { cellWidth: 90, halign: 'left' },
                1: { cellWidth: 20, halign: 'center' },
                2: { cellWidth: 35, halign: 'right' },
                3: { cellWidth: 35, halign: 'right' },
            },
            alternateRowStyles: {
                fillColor: [241, 245, 249],
            },
        });

        // ==================== SUBTOTAL & TOTAL ====================
        const tableEndY = doc.lastAutoTable.finalY;

        // Subtotal row
        const subX = margin + 90 + 20; // After description + qty columns
        doc.setDrawColor(...vSecondary);
        doc.setLineWidth(0.3);
        doc.line(subX, tableEndY + 2, pageW - margin, tableEndY + 2);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...textDark);
        doc.text('SUBTOTAL', subX + 2, tableEndY + 8);
        doc.text(`Rs. ${total.toFixed(2)}`, pageW - margin - 2, tableEndY + 8, { align: 'right' });

        // Total row with vibrant background
        doc.setFillColor(...vPrimary);
        doc.rect(subX, tableEndY + 12, contentW - 90 - 20, 10, 'F');
        doc.setFont('times', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...white);
        doc.text('TOTAL', subX + 4, tableEndY + 18.5);
        doc.text(`Rs. ${total.toFixed(2)}`, pageW - margin - 4, tableEndY + 18.5, { align: 'right' });

        const statusY = tableEndY + 30;
        if (Paid_Date && Paid_Date !== 'PENDING') {
            doc.setFillColor(236, 253, 245); // Light emerald bg
            doc.roundedRect(margin, statusY, contentW, 20, 2, 2, 'F');
            doc.setDrawColor(...vSecondary);
            doc.setLineWidth(0.5);
            doc.roundedRect(margin, statusY, contentW, 20, 2, 2, 'S');

            doc.setFont('times', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(5, 150, 105); // Modern green
            const statusLine = "PAID on " + Paid_Date + " | Mode: " + Payment_Mode;
            doc.text(statusLine, margin + 5, statusY + 8);

            doc.setFont('times', 'normal');
            doc.setFontSize(9);
            let detailLine = "TXN: " + Transaction_ID;
            if (tenantData.UPI_ID) detailLine += " | UPI ID: " + tenantData.UPI_ID;
            if (tenantData.Payment_ID && tenantData.Payment_ID !== Transaction_ID) detailLine += " | PAY ID: " + tenantData.Payment_ID;
            doc.text(detailLine, margin + 5, statusY + 13);

            if (tenantData.Order_ID) {
                doc.text(`ORDER ID: ${tenantData.Order_ID}`, margin + 5, statusY + 17);
            }
        }

        // ==================== THANK YOU ====================
        const tyY = statusY + 28;
        doc.setFont('times', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(...vAccent);
        doc.text('THANK YOU', margin, tyY);

        // ==================== FOOTER ====================
        const footerLineY = Math.max(tyY + 15, 268);
        doc.setDrawColor(...vSecondary);
        doc.setLineWidth(0.4);
        doc.line(margin, footerLineY, pageW - margin, footerLineY);

        doc.setFont('times', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(...textMid);
        doc.text('For questions concerning this invoice, please contact', pageW / 2, footerLineY + 6, { align: 'center' });
        doc.text(String(config.businessName) + ", " + String(config.ownerPhone || 'N/A') + ", UPI: " + String(config.upiId || 'N/A'), pageW / 2, footerLineY + 11, { align: 'center' });

        doc.setFont('times', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...textMid);
        doc.text('This is a computer-generated invoice. No signature required.', pageW / 2, footerLineY + 18, { align: 'center' });

        // ==================== SAVE ====================
        const fileName = tenantData.fileName || `invoice_${Phone}_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../uploads', fileName);

        const buffer = Buffer.from(doc.output('arraybuffer'));
        fs.writeFileSync(filePath, buffer);

        return { fileName, filePath };
    }

    async generateRegistrationForm(tenantData) {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        if (typeof doc.setCharSpace === 'function') doc.setCharSpace(0);
        const { name, phone, room, sharingType, advance, monthlyRent } = tenantData;

        // Vibrant Palette for Form
        const vPrimary = [79, 70, 229];      // Indigo
        const vSecondary = [6, 182, 212];    // Teal
        const vAccent = [139, 92, 246];      // Purple

        // ==================== VIBRANT BRANDING HEADER ====================
        const lX = 20;
        const lY = 12;
        doc.setDrawColor(...vPrimary);
        doc.setLineWidth(1);
        doc.line(lX, lY + 8, lX + 10, lY);
        doc.line(lX + 10, lY, lX + 20, lY + 8);
        doc.line(lX, lY + 8, lX + 20, lY + 8);
        doc.rect(lX + 4, lY + 8, 12, 10);

        doc.setLineWidth(1.2);
        doc.setDrawColor(...vSecondary);
        doc.line(lX + 5, lY + 12, lX + 15, lY + 12);
        doc.line(lX + 15, lY + 12, lX + 15, lY + 16);
        doc.setDrawColor(...vAccent);
        doc.line(lX + 15, lY + 16, lX + 5, lY + 16);
        doc.setDrawColor(...vSecondary);
        doc.line(lX + 5, lY + 20, lX + 15, lY + 20);

        doc.setFont('times', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(...vPrimary);
        doc.text("Stay", lX + 25, 20);
        doc.setTextColor(...vSecondary);
        doc.text("Flow", lX + 37, 20);

        doc.setFont('times', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('PREMIUM PG MANAGEMENT', lX + 25, 24);

        // Header Background
        const headerY = 35;
        doc.setFillColor(...vPrimary);
        doc.rect(0, headerY, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('times', 'bold');
        doc.setFontSize(26);
        doc.text(String(config.businessName), 20, headerY + 18);
        doc.setFont('times', 'normal');
        doc.setFontSize(14);
        doc.text('New Resident Registration Form', 20, headerY + 28);

        // Registration Info
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(14);
        doc.text('Resident Details', 20, headerY + 55);

        autoTable(doc, {
            startY: headerY + 60,
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
        const rulesY = doc.lastAutoTable.finalY + 12;
        doc.setFont('times', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(...vPrimary);
        doc.text('PG House Rules & Regulations', 20, rulesY);

        doc.setFont('times', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
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

        let currentY = rulesY + 10;
        rules.forEach(rule => {
            // Check if we are near the bottom of the page
            if (currentY > 260) {
                doc.addPage();
                currentY = 20;
            }
            doc.text(String(rule), 25, currentY);
            currentY += 8;
        });

        // Footer Disclaimer
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        const footerMsg1 = 'I hereby agree to abide by the rules and regulations of the PG.';
        const footerMsg2 = 'This is a digital copy for your records.';

        // Ensure footer is at least 20mm after rules, but no higher than 270mm
        // If it spills past the page, add a new page
        let footerStart = currentY + 12;
        if (footerStart > 270) {
            doc.addPage();
            footerStart = 40; // Start higher on new page
        } else {
            footerStart = Math.max(footerStart, 270);
        }

        doc.text(footerMsg1, 105, footerStart, { align: 'center' });
        doc.text(footerMsg2, 105, footerStart + 7, { align: 'center' });
        doc.setFont('times', 'bold');
        doc.text(String(config.businessName), 105, footerStart + 14, { align: 'center' });

        const fileName = tenantData.fileName || `registration_${phone}_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../uploads', fileName);

        const buffer = Buffer.from(doc.output('arraybuffer'));
        fs.writeFileSync(filePath, buffer);

        return { fileName, filePath };
    }
    async generateVacateForm(data) {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        if (typeof doc.setCharSpace === 'function') doc.setCharSpace(0);

        const { name, phone, room, sharingType, monthlyRent, advance, reason, requestDate, vacateDate } = data;

        const vPrimary = [79, 70, 229];
        const vSecondary = [6, 182, 212];
        const vAccent = [220, 38, 38];    // Red accent for vacate
        const textDark = [15, 23, 42];
        const textMid = [71, 85, 105];
        const white = [255, 255, 255];

        // ==================== BRANDING HEADER ====================
        const lX = 20;
        const lY = 12;
        doc.setDrawColor(...vPrimary);
        doc.setLineWidth(1);
        doc.line(lX, lY + 8, lX + 10, lY);
        doc.line(lX + 10, lY, lX + 20, lY + 8);
        doc.line(lX, lY + 8, lX + 20, lY + 8);
        doc.rect(lX + 4, lY + 8, 12, 10);

        doc.setLineWidth(1.2);
        doc.setDrawColor(...vSecondary);
        doc.line(lX + 5, lY + 12, lX + 15, lY + 12);
        doc.line(lX + 15, lY + 12, lX + 15, lY + 16);
        doc.setDrawColor(...vAccent);
        doc.line(lX + 15, lY + 16, lX + 5, lY + 16);
        doc.setDrawColor(...vSecondary);
        doc.line(lX + 5, lY + 20, lX + 15, lY + 20);

        doc.setFont('times', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(...vPrimary);
        doc.text("Stay", lX + 25, 20);
        doc.setTextColor(...vSecondary);
        doc.text("Flow", lX + 37, 20);

        doc.setFont('times', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('PREMIUM PG MANAGEMENT', lX + 25, 24);

        // ==================== TITLE HEADER ====================
        const headerY = 35;
        doc.setFillColor(...vAccent);
        doc.rect(0, headerY, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('times', 'bold');
        doc.setFontSize(26);
        doc.text(String(config.businessName), 20, headerY + 18);
        doc.setFont('times', 'normal');
        doc.setFontSize(14);
        doc.text('Room Vacate Request Form', 20, headerY + 28);

        // Request ID
        const reqId = `VR-${Date.now().toString().slice(-6)}`;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text(`Request ID: ${reqId}`, 210 - 20, headerY + 18, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Date: ${requestDate}`, 210 - 20, headerY + 28, { align: 'right' });

        // ==================== TENANT DETAILS TABLE ====================
        doc.setTextColor(...textDark);
        doc.setFont('times', 'bold');
        doc.setFontSize(14);
        doc.text('Tenant Details', 20, headerY + 55);

        autoTable(doc, {
            startY: headerY + 60,
            body: [
                ['Full Name', String(name)],
                ['Phone Number', String(phone)],
                ['Room Number', String(room || 'N/A')],
                ['Sharing Type', String(sharingType || 'N/A')],
                ['Monthly Rent', `INR ${monthlyRent || '0'}`],
                ['Advance Paid', `INR ${advance || '0'}`],
            ],
            theme: 'grid',
            styles: { fontSize: 11, cellPadding: 5 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60, fillColor: [248, 250, 252] } },
        });

        // ==================== VACATE DETAILS TABLE ====================
        const vacateTableY = doc.lastAutoTable.finalY + 10;
        doc.setFont('times', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...vAccent);
        doc.text('Vacate Request Details', 20, vacateTableY);

        autoTable(doc, {
            startY: vacateTableY + 5,
            body: [
                ['Request Date', String(requestDate)],
                ['Expected Vacate Date', String(vacateDate)],
                ['Reason for Leaving', String(reason || 'Not specified')],
                ['Notice Period', '30 Days'],
                ['Advance Refund Status', 'Pending Admin Approval'],
            ],
            theme: 'grid',
            styles: { fontSize: 11, cellPadding: 5 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60, fillColor: [254, 242, 242] } },
        });

        // ==================== CHECKLIST ====================
        const checkY = doc.lastAutoTable.finalY + 12;
        doc.setFont('times', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(...vPrimary);
        doc.text('Checkout Checklist', 20, checkY);

        doc.setFont('times', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...textMid);
        const checklist = [
            '[ ] All pending dues cleared (Rent + EB)',
            '[ ] Room key returned to admin',
            '[ ] Room inspected for damages',
            '[ ] Personal belongings removed',
            '[ ] Advance refund processed (if applicable)',
            '[ ] Final settlement signed',
        ];

        let cY = checkY + 8;
        checklist.forEach(item => {
            doc.text(item, 25, cY);
            cY += 7;
        });

        // ==================== STATUS BOX ====================
        const statusY = cY + 8;
        doc.setFillColor(254, 243, 199); // Light amber
        doc.roundedRect(15, statusY, 180, 18, 2, 2, 'F');
        doc.setDrawColor(245, 158, 11);
        doc.setLineWidth(0.5);
        doc.roundedRect(15, statusY, 180, 18, 2, 2, 'S');

        doc.setFont('times', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(180, 83, 9);
        doc.text('STATUS: PENDING ADMIN APPROVAL', 20, statusY + 8);
        doc.setFont('times', 'normal');
        doc.setFontSize(9);
        doc.text('Admin will review and confirm the vacate request. You will be notified.', 20, statusY + 14);

        // ==================== FOOTER ====================
        let footerStart = Math.max(statusY + 30, 260);
        if (footerStart > 270) {
            doc.addPage();
            footerStart = 40;
        }

        doc.setDrawColor(...vSecondary);
        doc.setLineWidth(0.4);
        doc.line(15, footerStart, 195, footerStart);

        doc.setFont('times', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(...textMid);
        doc.text('This is a computer-generated vacate request form. No signature required.', 105, footerStart + 6, { align: 'center' });
        doc.setFont('times', 'bold');
        doc.text(String(config.businessName) + ' | ' + String(config.ownerPhone || 'N/A'), 105, footerStart + 12, { align: 'center' });

        // ==================== SAVE ====================
        const fileName = data.fileName || `vacate_${phone}_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../uploads', fileName);

        const buffer = Buffer.from(doc.output('arraybuffer'));
        fs.writeFileSync(filePath, buffer);

        return { fileName, filePath, requestId: reqId };
    }
}

export default new PDFService();
