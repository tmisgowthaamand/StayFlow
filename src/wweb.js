// WhatsApp Web.js is disabled - using Cloud API only
// This file is kept as a stub to prevent import errors

export default {
    ready: false,
    init: () => console.log('⚠️ WhatsApp Web.js disabled. Using Cloud API only.'),
    sendMessage: () => Promise.reject(new Error('WWeb not available')),
    sendImage: () => Promise.reject(new Error('WWeb not available'))
};
