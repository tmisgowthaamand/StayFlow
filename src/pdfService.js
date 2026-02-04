const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable').default;
const fs = require('fs');
const path = require('path');
const config = require('./config');

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
}

module.exports = new PDFService();
