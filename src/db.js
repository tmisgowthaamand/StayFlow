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

const mediaSchema = new mongoose.Schema({
    phone: String,
    type: { type: String, enum: ['AADHAAR', 'PAYMENT_PROOF', 'OTHER'] },
    mediaId: String,
    url: String,
    timestamp: { type: Date, default: Date.now }
});

const tenantSchema = new mongoose.Schema({
    name: String,
    phone: String,
    room: String,
    bed: String,
    floor: String,
    location: String,
    sharingType: String,
    advance: String,
    monthlyRent: String,
    ebAmount: String,
    totalAmount: String,
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

const Log = mongoose.model('Log', logSchema);
const Media = mongoose.model('Media', mediaSchema);
const Tenant = mongoose.model('Tenant', tenantSchema);
const Notification = mongoose.model('Notification', notificationSchema);

export { Log, Media, Tenant, Notification };
