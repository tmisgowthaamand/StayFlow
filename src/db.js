const mongoose = require('mongoose');
const config = require('./config');

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

const Log = mongoose.model('Log', logSchema);
const Media = mongoose.model('Media', mediaSchema);

module.exports = { Log, Media };
