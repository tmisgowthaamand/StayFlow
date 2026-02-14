import mongoose from 'mongoose';
import config from './config.js';

mongoose.connect(config.mongoUri)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

const logSchema = new mongoose.Schema({
    phone: String,
    action: String,
    details: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now }
});
// Index for tracking unique events like Razorpay Webhook IDs
logSchema.index({ "details.id": 1 }, { unique: true, sparse: true });

const mediaSchema = new mongoose.Schema({
    phone: String,
    type: { type: String, enum: ['AADHAAR', 'PAYMENT_PROOF', 'OTHER'] },
    mediaId: String,
    url: String,
    timestamp: { type: Date, default: Date.now }
});

const tenantSchema = new mongoose.Schema({
    name: String,
    phone: { type: String, unique: true },
    room: String,
    bed: String,
    floor: String,
    location: String,
    sharingType: String,
    advance: { type: Number, default: 0 },
    monthlyRent: { type: Number, default: 0 },
    ebAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    status: String,
    joinDate: String,
    paidDate: String,
    aadhaarImage: String,
    archivedAt: { type: Date, default: Date.now }
});

const notificationSchema = new mongoose.Schema({
    type: String, // 'invoice_sent', 'payment_received', 'issue_submitted', etc.
    title: String,
    body: String,
    meta: mongoose.Schema.Types.Mixed,
    read: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
});

const sessionSchema = new mongoose.Schema({
    phone: { type: String, unique: true },
    state: mongoose.Schema.Types.Mixed,
    updatedAt: { type: Date, default: Date.now, expires: 3600 } // TTL 1 hour
});

const paymentSchema = new mongoose.Schema({
    trxId: { type: String, unique: true, required: true },
    phone: String,
    name: String,
    amountPaise: { type: Number, required: true }, // Store as Integer (Paise) to avoid float issues
    mode: { type: String, enum: ['RAZORPAY', 'CASH', 'UPI'] },
    status: { type: String, enum: ['PENDING', 'VALID', 'INVALID'], default: 'PENDING' },
    date: { type: String },
    meta: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now }
});

const Log = mongoose.model('Log', logSchema);
const Media = mongoose.model('Media', mediaSchema);
const Tenant = mongoose.model('Tenant', tenantSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const Payment = mongoose.model('Payment', paymentSchema);

/**
 * PHASE 3 REQ 10: Automated Backups
 * Exports all critical data for external storage
 */
async function exportAllData() {
    const tenants = await Tenant.find({}).lean();
    const payments = await Payment.find({}).lean();
    const logs = await Log.find({}).lean();
    return { tenants, payments, logs, timestamp: new Date().toISOString() };
}

export { Log, Media, Tenant, Notification, Session, Payment, exportAllData };
