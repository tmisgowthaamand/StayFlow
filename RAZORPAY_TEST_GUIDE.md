# Razorpay Test Payment Guide

## Issue Observed
Payment showing "Payment could not be completed" error with transaction ID: `rzp_test_SgWYZfyUuvQl5f`

This typically means:
- Payment was cancelled by user
- Payment failed during processing
- Network issue during payment
- Invalid test credentials used

## Current Configuration

### Razorpay Test Credentials (from .env)
```
RAZORPAY_KEY_ID=rzp_test_RxL3Ftiwabk6Wd
RAZORPAY_KEY_SECRET=xwsKFmN2QVV5eujulU2yfgI7
```

✅ These are valid Razorpay TEST mode credentials

## How to Successfully Test Razorpay Payment

### Method 1: Test UPI Payment (RECOMMENDED)

1. **Open Payment Link**
   ```
   http://localhost:3000/payment.html?phone=917010905730&name=Vikram%20Singh
   ```
   Or use the Vercel URL:
   ```
   https://stay-flow-kohl.vercel.app/payment?phone=917010905730&name=Vikram%20Singh
   ```

2. **Click "Pay Now" Button**
   - Razorpay checkout modal will open

3. **Select UPI Payment Method**
   - Click on "UPI" option
   - Click "Add New UPI ID"

4. **Enter Test UPI ID**
   ```
   success@razorpay
   ```
   ⚠️ **IMPORTANT**: Use exactly `success@razorpay` (all lowercase)

5. **Click Continue/Pay**
   - Payment will be automatically approved
   - You'll be redirected to WhatsApp

6. **Send Pre-filled Message**
   - WhatsApp opens with: "Paid successfully using Razorpay"
   - Send the message

7. **Receive Invoice PDF**
   - Bot will send confirmation + invoice PDF immediately

### Method 2: Test Card Payment

1. **Open Payment Link** (same as above)

2. **Click "Pay Now" Button**

3. **Select "Cards" Option**

4. **Enter Test Card Details**
   ```
   Card Number: 4111 1111 1111 1111
   Expiry: Any future date (e.g., 12/25)
   CVV: 123
   Name: Test User
   ```

5. **Click Pay**
   - Payment will be approved
   - Redirect to WhatsApp

### Method 3: Test NetBanking

1. **Open Payment Link**

2. **Select "NetBanking"**

3. **Choose Any Bank** (e.g., HDFC, ICICI)

4. **On Bank Page**
   - Click "Success" button (test mode)

5. **Redirect to WhatsApp**

## Common Test Credentials

### Test UPI IDs
```
✅ success@razorpay     → Payment succeeds
❌ failure@razorpay     → Payment fails
⏳ pending@razorpay     → Payment pending
```

### Test Card Numbers
```
✅ 4111 1111 1111 1111  → Visa (Success)
✅ 5555 5555 5555 4444  → Mastercard (Success)
✅ 3782 822463 10005    → Amex (Success)
❌ 4000 0000 0000 0002  → Card declined
```

### Test CVV
```
Any 3-digit number (e.g., 123, 456, 789)
```

### Test Expiry
```
Any future date (e.g., 12/25, 06/27)
```

## Troubleshooting Payment Errors

### Error: "Payment could not be completed"

**Possible Causes:**
1. ❌ User cancelled payment
2. ❌ Invalid test credentials entered
3. ❌ Network timeout
4. ❌ Razorpay test mode issue

**Solutions:**
1. ✅ Try again with `success@razorpay` UPI ID
2. ✅ Use test card: `4111 1111 1111 1111`
3. ✅ Check internet connection
4. ✅ Clear browser cache and retry

### Error: "Invalid API Key"

**Solution:**
```bash
# Check .env file has correct credentials
cat .env | grep RAZORPAY

# Should show:
RAZORPAY_KEY_ID=rzp_test_RxL3Ftiwabk6Wd
RAZORPAY_KEY_SECRET=xwsKFmN2QVV5eujulU2yfgI7
```

### Error: "Order creation failed"

**Solution:**
```bash
# Check backend is running
curl http://localhost:3000/api/payment-info?phone=917010905730 -H "x-api-key: stayflow_dev_key_123"

# Should return tenant data
```

### Error: "Signature verification failed"

**Solution:**
- This means payment was tampered with
- Razorpay will automatically reject it
- Try a fresh payment

## Testing the Complete Flow

### Step-by-Step Test

1. **Start Backend** (if not running)
   ```bash
   npm start
   ```

2. **Open Payment Page**
   ```
   http://localhost:3000/payment.html?phone=917010905730&name=Vikram%20Singh
   ```

3. **Verify Page Loads**
   - Should show: Vikram Singh, Room 303
   - Total: ₹7400 (₹7000 rent + ₹400 EB)

4. **Click "Pay ₹7400 Now"**
   - Razorpay modal opens

5. **Select UPI → Add New UPI ID**
   - Enter: `success@razorpay`
   - Click Continue

6. **Payment Succeeds**
   - Shows "Payment Successful! Verifying..."
   - Redirects to WhatsApp

7. **WhatsApp Opens**
   - Pre-filled: "Paid successfully using Razorpay"
   - Send message

8. **Bot Responds**
   ```
   ✅ Payment Confirmed!
   
   Thank you, Vikram Singh! 🎉
   
   📋 Payment Details:
   🏠 Rent: ₹7000
   ⚡ EB: ₹400
   💰 Total: ₹7400
   
   💳 Mode: UPI (Razorpay)
   🔖 TXN ID: pay_ABC123XYZ
   📅 Date: 22/4/2026
   
   Your invoice is attached below. 👇
   
   [PDF: StayFlow_Invoice.pdf]
   ```

## Verify Payment in System

### Check Google Sheets
```bash
curl http://localhost:3000/api/tenants -H "x-api-key: stayflow_dev_key_123" | jq '.[] | select(.Phone=="917010905730")'
```

**Expected Output:**
```json
{
  "Name": "Vikram Singh",
  "Phone": "917010905730",
  "Room": "303",
  "Status": "PAID",
  "Payment Mode": "UPI (Razorpay)",
  "Transaction ID": "pay_ABC123XYZ",
  "Paid Date": "22/4/2026",
  "Total Amount": "7400"
}
```

### Check Dashboard
```bash
curl http://localhost:3000/api/dashboard-stats -H "x-api-key: stayflow_dev_key_123"
```

**Expected:**
- `paidCount` should increase by 1
- `totalRevenue` should increase by ₹7400

## Test Mode Banner

When using test credentials, you'll see a yellow banner:
```
🧪 TEST MODE: To test payment, select "Add New UPI ID" 
and enter success@razorpay
```

This confirms you're in test mode and provides guidance.

## Moving to Production

### When Ready for Live Payments:

1. **Get Production Credentials**
   - Login to Razorpay Dashboard
   - Go to Settings → API Keys
   - Generate Production keys

2. **Update .env File**
   ```bash
   RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXX
   RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXX
   ```

3. **Restart Backend**
   ```bash
   npm start
   ```

4. **Test with Real Payment**
   - Use actual UPI ID
   - Use real card
   - Real money will be charged

5. **Verify Webhook**
   - Ensure webhook URL is configured in Razorpay Dashboard
   - URL: `https://stayflow-tkto.onrender.com/webhook/razorpay`

## Quick Test Commands

### Test Payment Info API
```bash
curl "http://localhost:3000/api/payment-info?phone=917010905730&name=Vikram%20Singh"
```

### Test Create Order API
```bash
curl -X POST http://localhost:3000/api/create-order \
  -H "Content-Type: application/json" \
  -d '{"phone":"917010905730","name":"Vikram Singh","amount":7400,"room":"303"}'
```

### Check Backend Logs
```bash
# Windows PowerShell
Get-Content debug.log -Tail 50

# Or check process output
# (use the terminal ID from listProcesses)
```

## Common Mistakes to Avoid

1. ❌ **Using real UPI ID in test mode**
   - Use `success@razorpay` instead

2. ❌ **Entering wrong card number**
   - Use `4111 1111 1111 1111`

3. ❌ **Cancelling payment**
   - Complete the payment flow

4. ❌ **Not waiting for redirect**
   - Wait for "Payment Successful! Verifying..." message

5. ❌ **Closing WhatsApp before sending message**
   - Send the pre-filled message to trigger invoice

## Success Indicators

### ✅ Payment Successful When:
1. Razorpay shows "Payment Successful"
2. Page shows "Verifying..."
3. Redirects to WhatsApp
4. Bot sends invoice PDF
5. Status changes to PAID in sheets

### ❌ Payment Failed When:
1. Shows "Payment could not be completed"
2. Shows "Payment failed"
3. No redirect to WhatsApp
4. Status remains PENDING

## Support

### If Payment Still Fails:

1. **Check Razorpay Dashboard**
   - Login to https://dashboard.razorpay.com
   - Go to Transactions
   - Check if payment is recorded

2. **Check Backend Logs**
   ```bash
   tail -f debug.log | grep -i razorpay
   ```

3. **Verify Credentials**
   ```bash
   # Test API connection
   curl -u rzp_test_RxL3Ftiwabk6Wd:xwsKFmN2QVV5eujulU2yfgI7 \
     https://api.razorpay.com/v1/payments
   ```

4. **Contact Razorpay Support**
   - Email: support@razorpay.com
   - Provide transaction ID

## Summary

To successfully test Razorpay payment:
1. ✅ Use `success@razorpay` as UPI ID
2. ✅ Or use card `4111 1111 1111 1111`
3. ✅ Complete the payment (don't cancel)
4. ✅ Wait for WhatsApp redirect
5. ✅ Send pre-filled message
6. ✅ Receive invoice PDF

**The error you saw was likely because the payment was cancelled or failed during processing. Try again with the test credentials above!** 🚀
