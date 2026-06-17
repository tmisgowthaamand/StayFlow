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
}, { strict: true });
// Index for tracking unique events like Razorpay Webhook IDs
logSchema.index({ "details.id": 1 }, { unique: true, sparse: true });
// Performance indexes
logSchema.index({ phone: 1, action: 1, timestamp: -1 }); // Fast per-user action history
logSchema.index({ action: 1, timestamp: -1 });            // Fast action-type queries

const mediaSchema = new mongoose.Schema({
    phone: String,
    type: { type: String, enum: ['AADHAAR', 'PAYMENT_PROOF', 'REGISTRATION', 'OTHER'] },
    mediaId: String,
    url: String,
    filename: String,
    mimeType: String,
    provider: String, // 'cloudinary', 'local', etc.
    publicId: String, // Cloudinary public ID
    resourceType: String, // 'image', 'raw', etc.
    format: String, // File format
    bytes: Number, // File size
    data: Buffer,
    encrypted: { type: Boolean, default: false },
    encryptionIV: String,
    encryptionTag: String,
    timestamp: { type: Date, default: Date.now }
}, { strict: true });

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
}, { strict: true });

// Performance indexes for common query patterns
tenantSchema.index({ phone: 1, name: 1 });   // Fast phone+name lookup
tenantSchema.index({ status: 1 });            // Fast status filtering (PAID/PENDING/VACATED)
tenantSchema.index({ location: 1 });          // Fast per-location queries

const notificationSchema = new mongoose.Schema({
    type: String, // 'invoice_sent', 'payment_received', 'issue_submitted', etc.
    title: String,
    body: String,
    meta: mongoose.Schema.Types.Mixed,
    read: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
}, { strict: true });

const sessionSchema = new mongoose.Schema({
    phone: { type: String, unique: true },
    state: mongoose.Schema.Types.Mixed,
    updatedAt: { type: Date, default: Date.now, expires: 3600 } // TTL 1 hour
}, { strict: true });

const paymentSchema = new mongoose.Schema({
    trxId: { type: String, unique: true, required: true },
    phone: String,
    name: String,
    amountPaise: { type: Number, required: true }, // Store as Integer (Paise) to avoid float issues
    mode: { type: String, enum: ['RAZORPAY', 'CASH', 'UPI'] },
    status: { type: String, enum: ['PENDING', 'VALID', 'INVALID'], default: 'PENDING' },
    date: { type: String },
    meta: mongoose.Schema.Types.Mixed,
    // Issue 2 fix: track if 24h admin reminder has been sent for stale PENDING CASH payments
    cashReminderSent: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
}, { strict: true });

const querySchema = new mongoose.Schema({
    queryId: { type: String, unique: true, required: true },
    tenantName: String,
    phone: String,
    room: String,
    category: { type: String, default: 'General' },
    message: String,
    status: { type: String, enum: ['PENDING', 'ACKNOWLEDGED', 'RESOLVED'], default: 'PENDING' },
    adminReply: String,
    autoReplySent: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: Date
}, { strict: true });

const pushTokenSchema = new mongoose.Schema({
    token: { type: String, unique: true, required: true },
    platform: String,
    lastUsed: { type: Date, default: Date.now }
}, { strict: true });

const Log = mongoose.model('Log', logSchema);
const Media = mongoose.model('Media', mediaSchema);
const Tenant = mongoose.model('Tenant', tenantSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const Session = mongoose.model('Session', sessionSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Query = mongoose.model('Query', querySchema);
const PushToken = mongoose.model('PushToken', pushTokenSchema);

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

export { Log, Media, Tenant, Notification, Session, Payment, Query, PushToken, exportAllData };
