import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

/**
 * Generate a vacate approval card image (900x600, 3:2 ratio)
 * @param {Object} data - { name, room, reason, vacateDate, approvedBy }
 * @returns {string} filePath to the generated PNG
 */
export function generateVacateApprovalCard(data) {
    const { name, room, reason, vacateDate, approvedBy } = data;
    const W = 900, H = 600;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // === BACKGROUND ===
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#1e293b');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 30) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
    for (let i = 0; i < H; i += 30) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }

    // === TOP ACCENT BAR ===
    const topGrad = ctx.createLinearGradient(0, 0, W, 0);
    topGrad.addColorStop(0, '#10b981');
    topGrad.addColorStop(1, '#06b6d4');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, W, 6);

    // === STAYFLOW BRANDING (top-left) ===
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.fillStyle = '#4f46e5';
    ctx.fillText('Stay', 40, 45);
    ctx.fillStyle = '#06b6d4';
    ctx.fillText('Flow', 82, 45);
    ctx.font = '11px Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('PREMIUM PG MANAGEMENT', 40, 60);

    // === GREEN BADGE - Approved ===
    roundRect(ctx, W - 200, 25, 160, 40, 20);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('✅ APPROVED', W - 175, 51);

    // === TITLE ===
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Vacate Request Approved', 40, 110);

    // === DIVIDER ===
    const divGrad = ctx.createLinearGradient(40, 0, W - 40, 0);
    divGrad.addColorStop(0, '#10b981');
    divGrad.addColorStop(0.5, '#06b6d4');
    divGrad.addColorStop(1, 'rgba(6,182,212,0)');
    ctx.fillStyle = divGrad;
    ctx.fillRect(40, 125, W - 80, 3);

    // === DETAILS CARD ===
    roundRect(ctx, 40, 150, W - 80, 280, 16);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Detail rows
    const details = [
        { icon: '👤', label: 'Name', value: name || 'N/A' },
        { icon: '🚪', label: 'Room', value: room || 'N/A' },
        { icon: '📋', label: 'Reason', value: reason || 'N/A' },
        { icon: '📅', label: 'Vacate By', value: vacateDate || 'N/A' },
        { icon: '📌', label: 'Status', value: `APPROVED (${approvedBy || 'Admin'})` },
    ];

    let yPos = 195;
    details.forEach((d) => {
        // Icon
        ctx.font = '22px Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(d.icon, 70, yPos);

        // Label
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(d.label, 110, yPos);

        // Colon
        ctx.fillStyle = '#64748b';
        ctx.fillText(':', 260, yPos);

        // Value
        ctx.font = '18px Arial, sans-serif';
        ctx.fillStyle = '#f1f5f9';
        const val = String(d.value).length > 40 ? String(d.value).substring(0, 37) + '...' : String(d.value);
        ctx.fillText(val, 280, yPos);

        yPos += 48;
    });

    // === BOTTOM MESSAGE ===
    ctx.font = '16px Arial, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Your vacate request has been approved.', 40, 475);
    ctx.fillText('Please clear any pending dues and return your room key.', 40, 498);

    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillStyle = '#10b981';
    ctx.fillText('Thank you for staying with us! 🙏', 40, 535);

    // === BOTTOM ACCENT BAR ===
    const botGrad = ctx.createLinearGradient(0, 0, W, 0);
    botGrad.addColorStop(0, '#10b981');
    botGrad.addColorStop(1, '#06b6d4');
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, H - 6, W, 6);

    // === SAVE ===
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const fileName = `vacate_approved_${Date.now()}.png`;
    const filePath = path.join(uploadsDir, fileName);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filePath, buffer);

    return filePath;
}

export default { generateVacateApprovalCard };
