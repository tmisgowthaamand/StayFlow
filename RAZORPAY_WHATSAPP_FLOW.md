# Razorpay Payment → WhatsApp Invoice Flow

## Overview
After a successful Razorpay payment, the user is automatically redirected to WhatsApp where they receive their paid invoice PDF immediately.

## Complete Flow

### 1. User Initiates Payment
- User receives bill notification on WhatsApp with payment link
- User clicks the payment link (e.g., `https://stay-flow-kohl.vercel.app/payment?phone=917010905730&name=Vikram%20Singh`)
- Payment page loads with bill details

### 2. Razorpay Payment Process
```
User clicks "Pay ₹7400 Now"
    ↓
Backend creates Razorpay order (/api/create-order)
    ↓
Razorpay checkout modal opens
    ↓
User completes payment (UPI/Card/NetBanking)
    ↓
Razorpay returns payment details
    ↓
Backend verifies payment signature (/api/verify-razorpay-payment)
    ↓
Payment marked as PAID in Google Sheets & MongoDB
```

### 3. Automatic WhatsApp Redirect
After successful payment verification:
```javascript
// payment.html (line 836)
const cleanBotPhone = '15551596475'; // WhatsApp bot number
const msg = 'Paid successfully using Razorpay';
const waUrl = `https://wa.me/${cleanBotPhone}?text=${encodeURIComponent(msg)}`;
window.location.href = waUrl;
```

**Result**: User is redirected to WhatsApp with pre-filled message

### 4. Bot Automatically Sends Invoice PDF
When bot receives "Paid successfully using Razorpay" message:

```javascript
// src/bot.js (lines 1296-1340)
if (clean.includes('PAID SUCCESSFULLY USING RAZORPAY')) {
    const status = tenant.get('Status');
    if (status === 'PAID' || status === 'VALID') {
        // Generate invoice PDF
        const { filePath } = await pdfService.generateInvoice({...});
        
        // Send confirmation message
        await sendMessage(phone, `✅ *Payment Confirmed!*
        
Thank you, ${name}! 🎉

📋 *Payment Details:*
🏠 Rent: ₹${rent}
⚡ EB: ₹${eb}
💰 *Total: ₹${total}*

💳 Mode: ${paymentMode}
🔖 TXN ID: ${trxId}
📅 Date: ${paidDate}

Your invoice is attached below. 👇`);
        
        // Send invoice PDF
        await sendMedia(phone, filePath, '📄 Your payment receipt', null, 'StayFlow_Invoice.pdf');
    }
}
```

## User Experience Timeline

```
[Payment Page]
User pays ₹7400 via Razorpay
    ↓ (2-3 seconds)
[Payment Success Screen]
"Payment Successful! Verifying..."
    ↓ (1 second)
[WhatsApp Opens]
Pre-filled message: "Paid successfully using Razorpay"
User sends the message (or it auto-sends)
    ↓ (1-2 seconds)
[WhatsApp Bot Response]
✅ Payment Confirmed message
    ↓ (immediately)
📄 Invoice PDF attachment
```

## WhatsApp Bot Number
- **Display**: +1 (555) 159-6475
- **Format for wa.me**: 15551596475
- **Used in**: `public/payment.html`, `public/confirmation.html`

## Invoice PDF Details
The invoice PDF includes:
- Tenant name, phone, room
- Monthly rent breakdown
- EB (electricity) charges
- Total amount paid
- Payment mode (UPI/Razorpay)
- Transaction ID
- Payment date
- UPI ID (if available)
- Razorpay Payment ID
- Razorpay Order ID

## Code Changes Made

### 1. Modified `src/bot.js` (lines 1296-1340)
**Before**:
```javascript
if (clean.includes('PAID SUCCESSFULLY USING RAZORPAY')) {
    if (status === 'PAID') {
        await sendMessage(phone, `✅ Payment Confirmed! Type *RECEIPT* to download invoice.`);
    }
}
```

**After**:
```javascript
if (clean.includes('PAID SUCCESSFULLY USING RAZORPAY')) {
    if (status === 'PAID' || status === 'VALID') {
        // Generate invoice PDF
        const { filePath } = await pdfService.generateInvoice({...});
        
        // Send confirmation + invoice PDF immediately
        await sendMessage(phone, `✅ Payment Confirmed! ...`);
        await sendMedia(phone, filePath, '📄 Your payment receipt', null, 'StayFlow_Invoice.pdf');
    }
}
```

### 2. Existing `public/payment.html` (already correct)
```javascript
// Line 836 - Redirect to WhatsApp after payment
const waUrl = `https://wa.me/${cleanBotPhone}?text=${encodeURIComponent(msg)}`;
window.location.href = waUrl;
```

## Testing the Flow

### Test with Razorpay Test Mode
1. Use test phone number: `917010905730` (Vikram Singh)
2. Open payment link: `http://localhost:3000/payment.html?phone=917010905730&name=Vikram%20Singh`
3. Click "Pay Now"
4. In Razorpay test mode, select "Add New UPI ID"
5. Enter: `success@razorpay` (test UPI ID)
6. Complete payment
7. You'll be redirected to WhatsApp
8. Send the pre-filled message
9. Bot will immediately send invoice PDF

### Expected WhatsApp Messages
```
User → Bot: "Paid successfully using Razorpay"

Bot → User:
✅ *Payment Confirmed!*

Thank you, Vikram Singh! 🎉

📋 *Payment Details:*
🏠 Rent: ₹7000
⚡ EB: ₹400
💰 *Total: ₹7400*

💳 Mode: UPI (Razorpay)
🔖 TXN ID: pay_ABC123XYZ
📅 Date: 22/4/2026

Your invoice is attached below. 👇

[PDF Attachment: StayFlow_Invoice.pdf]
```

## Fallback Scenarios

### If Invoice Generation Fails
```javascript
catch (err) {
    console.error('Error generating invoice:', err.message);
    await sendMessage(phone, `✅ Payment Confirmed! Type *RECEIPT* to download invoice.`);
}
```

### If Payment Not Yet Synced
```javascript
else {
    await sendMessage(phone, `✅ We received your payment notification.
    
Please allow a few moments for the system to update your status.`);
}
```

## API Endpoints Involved

### 1. `/api/create-order` (POST)
Creates Razorpay order
```json
Request: {
  "phone": "917010905730",
  "name": "Vikram Singh",
  "amount": 7400,
  "room": "303"
}

Response: {
  "orderId": "order_ABC123",
  "amount": 740000,
  "currency": "INR",
  "razorpayKeyId": "rzp_test_..."
}
```

### 2. `/api/verify-razorpay-payment` (POST)
Verifies payment signature
```json
Request: {
  "razorpay_order_id": "order_ABC123",
  "razorpay_payment_id": "pay_XYZ789",
  "razorpay_signature": "abc123...",
  "phone": "917010905730"
}

Response: {
  "success": true,
  "paymentId": "pay_XYZ789",
  "amount": 7400,
  "vpa": "user@upi"
}
```

### 3. `/webhook` (POST)
Handles incoming WhatsApp messages
```json
Request: {
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "917010905730",
          "text": {
            "body": "Paid successfully using Razorpay"
          }
        }]
      }
    }]
  }]
}
```

## Database Updates

### Google Sheets (Tenants)
```
Status: PENDING → PAID
Payment Mode: → UPI (Razorpay)
Transaction ID: → pay_ABC123XYZ
Paid Date: → 22/4/2026
```

### MongoDB (Payments Collection)
```javascript
{
  trxId: "pay_ABC123XYZ",
  phone: "917010905730",
  name: "Vikram Singh",
  amountPaise: 740000,
  mode: "RAZORPAY",
  status: "VALID",
  date: "22/04/2026",
  meta: {
    vpa: "user@upi",
    payment_id: "pay_ABC123XYZ",
    order_id: "order_ABC123"
  }
}
```

## Security Features

### 1. Payment Signature Verification
```javascript
const generatedSignature = crypto
    .createHmac('sha256', config.razorpay.key_secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

if (generatedSignature !== razorpay_signature) {
    return res.status(400).json({ error: 'Invalid signature' });
}
```

### 2. Amount Validation
```javascript
// Prevent "Pay ₹1" exploit
const expectedTotalPaise = rentPaise + ebPaise;
const paidPaise = toPaise(amount);

if (Math.abs(paidPaise - expectedTotalPaise) > 100) {
    // Fraud alert - notify admin
}
```

### 3. Idempotency Check
```javascript
// Prevent duplicate processing
const payment = await Payment.create({ trxId, ... });
if (err.code === 11000) {
    // Transaction already processed
    return;
}
```

## Advantages of This Flow

1. ✅ **Seamless UX**: User stays in WhatsApp ecosystem
2. ✅ **Instant Receipt**: Invoice PDF delivered immediately
3. ✅ **No Manual Steps**: Fully automated from payment to invoice
4. ✅ **Secure**: Payment signature verification + amount validation
5. ✅ **Reliable**: Multiple fallback mechanisms
6. ✅ **Trackable**: All transactions logged in database
7. ✅ **Mobile-Friendly**: Works perfectly on mobile devices

## Troubleshooting

### Issue: User redirected but no invoice received
**Solution**: Check if payment status is PAID in Google Sheets
```bash
curl http://localhost:3000/api/tenants -H "x-api-key: stayflow_dev_key_123" | jq '.[] | select(.Phone=="917010905730")'
```

### Issue: WhatsApp not opening
**Solution**: Verify bot number format
```javascript
// Correct format (no spaces, dashes, or +)
const cleanBotPhone = '15551596475';
```

### Issue: Invoice PDF not generating
**Solution**: Check backend logs
```bash
# Look for PDF generation errors
tail -f debug.log | grep "invoice"
```

## Summary

The complete flow ensures that after a successful Razorpay payment:
1. User is redirected to WhatsApp (+1 555 159-6475)
2. Pre-filled message is sent to bot
3. Bot automatically generates and sends invoice PDF
4. User receives payment confirmation + invoice in WhatsApp

**No manual intervention required!** 🎉
