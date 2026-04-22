# 🔧 WhatsApp Message Sending Issue - Fix Guide

## ❌ Problem

When clicking "Send Bill" to a resident (like Ziya) in the mobile app, the WhatsApp message is not being delivered.

---

## ✅ Root Cause Found

The **backend server was not running**! The mobile app was trying to send API requests to `https://stayflow-x8is.onrender.com/api/` but the local server wasn't active.

---

## 🎯 Current Status

### ✅ What's Working:
- Backend server is now running on **port 3000**
- API endpoint `/api/notify-tenant` exists and is functional
- Mobile app has correct API key (`stayflow_dev_key_123`)
- Dashboard is served correctly

### ⚠️ What's Not Working:
- **WhatsApp Web.js (wweb)** failed to initialize
- Error: Chrome/Chromium not found for Puppeteer
- This affects the fallback WhatsApp sending method

### ✅ What Still Works:
- **WhatsApp Cloud API** - Primary method for sending messages
- This should work even without wweb

---

## 🔍 Technical Details

### Backend Server Status:
```
✅ Server running on port 3000
✅ Google Gemini AI initialized
✅ Razorpay initialized
✅ Dashboard found and serving
✅ Keep-alive service started
❌ WhatsApp Web.js failed (Chrome not found)
```

### API Endpoint:
```javascript
POST /api/notify-tenant
Headers: { 'x-api-key': 'stayflow_dev_key_123' }
Body: { phone: '919876543210', name: 'Ziya' }
```

### What It Does:
1. Fetches tenant data from Google Sheets
2. Generates PDF invoice
3. Creates Razorpay payment link
4. Sends WhatsApp message with invoice + payment link
5. Creates in-app notification

---

## 🚀 Solution

### Option 1: Use Cloud API (Recommended)

The backend is configured to use **WhatsApp Cloud API** as the primary method. This should work without wweb.

**Check if Cloud API is configured:**
1. Open `.env` file
2. Verify these variables exist:
   ```env
   WHATSAPP_TOKEN=your_token_here
   WHATSAPP_PHONE_NUMBER_ID=your_phone_id
   ```

**If missing, add them:**
```env
WHATSAPP_TOKEN=EAAxxxxxxxxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_VERIFY_TOKEN=your_verify_token
WHATSAPP_CALLBACK_URL=https://your-domain.com/webhook
```

### Option 2: Fix WhatsApp Web.js (Optional)

If you want the fallback method to work:

**Install Chrome/Chromium:**
```bash
npx puppeteer browsers install chrome
```

Or use the system Chrome:
```bash
npm install puppeteer
```

---

## 🧪 Testing

### Test from Mobile App:
1. Open **Residents** screen
2. Find a resident (e.g., Ziya)
3. Tap the **Send** icon (bell/notification)
4. Check if WhatsApp message is sent

### Test from Backend:
```bash
# Check if server is running
curl http://localhost:3000/api/tenants -H "x-api-key: stayflow_dev_key_123"

# Test notify endpoint
curl -X POST http://localhost:3000/api/notify-tenant \
  -H "x-api-key: stayflow_dev_key_123" \
  -H "Content-Type: application/json" \
  -d '{"phone":"919876543210","name":"Ziya"}'
```

---

## 🔧 Troubleshooting

### Issue 1: "Unauthorized" Error

**Cause:** API key mismatch

**Fix:**
1. Check `.env` file: `ADMIN_API_KEY=stayflow_dev_key_123`
2. Check mobile app `api.js`: `'x-api-key': 'stayflow_dev_key_123'`
3. Make sure they match

### Issue 2: "Tenant not found"

**Cause:** Phone number format mismatch

**Fix:**
- Mobile app sends: `919876543210` (with country code)
- Sheets has: `9876543210` (without country code)
- Backend normalizes automatically

### Issue 3: WhatsApp Token Expired

**Cause:** Cloud API token expired (error code 190)

**Fix:**
1. Go to Meta Developer Console
2. Generate new **Permanent Access Token**
3. Update `.env`: `WHATSAPP_TOKEN=new_token`
4. Restart server

### Issue 4: Message Not Delivered

**Possible Causes:**
1. ❌ WhatsApp token expired
2. ❌ Phone number not registered on WhatsApp
3. ❌ 24-hour window expired (use template message)
4. ❌ Backend server not running

**Check Backend Logs:**
```bash
# Watch the terminal where backend is running
# You should see:
[WWeb] Message sent to 919876543210
# or
Message sent successfully to 919876543210
```

---

## 📊 Message Flow

```
Mobile App (Residents Screen)
    ↓
Tap "Send Bill" for Ziya
    ↓
API Call: POST /api/notify-tenant
    ↓
Backend Server (port 3000)
    ↓
1. Fetch tenant from Google Sheets
2. Generate PDF invoice
3. Create Razorpay payment link
4. Try WhatsApp Web.js (if available)
    ↓ (if fails)
5. Fallback to Cloud API
    ↓
WhatsApp Cloud API
    ↓
Message Delivered to Ziya's WhatsApp
```

---

## ⚙️ Configuration Check

### Required Environment Variables:

```env
# WhatsApp Cloud API (Required for sending)
WHATSAPP_TOKEN=EAAxxxxxxxxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=123456789012345

# Google Sheets (Required for tenant data)
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_email@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# MongoDB (Required for logging)
MONGODB_URI=mongodb://localhost:27017/stayflow

# Razorpay (Required for payment links)
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx

# Admin API Key (Required for mobile app)
ADMIN_API_KEY=stayflow_dev_key_123

# Owner Phone (Required for admin commands)
OWNER_PHONE=919876543210
```

---

## 🎯 Quick Fix Steps

### Step 1: Verify Backend is Running
```bash
# Check if port 3000 is listening
netstat -ano | findstr :3000
```

### Step 2: Check Environment Variables
```bash
# In project root
cat .env | grep WHATSAPP
cat .env | grep ADMIN_API_KEY
```

### Step 3: Test API Endpoint
```bash
# From mobile app or Postman
POST http://localhost:3000/api/notify-tenant
Headers: x-api-key: stayflow_dev_key_123
Body: {"phone":"919876543210","name":"Ziya"}
```

### Step 4: Check Backend Logs
Watch the terminal where backend is running for:
- ✅ "Message sent successfully"
- ❌ "Error sending message"
- ⚠️ "WhatsApp Token Expired"

---

## 🌐 Production vs Development

### Development (Local):
- Backend: `http://localhost:3000`
- Mobile app points to: `https://stayflow-x8is.onrender.com/api/`
- **Issue:** Mobile app is pointing to production, not local!

### Fix for Local Testing:

**Option A: Change Mobile App API URL**
```javascript
// mobile/src/api/api.js
const API_BASE_URL = 'http://192.168.1.17:3000/api/';
```

**Option B: Use Production Backend**
- Keep mobile app pointing to `https://stayflow-x8is.onrender.com/api/`
- Make sure production server is running on Render
- Check Render dashboard for logs

---

## 🔴 Critical Issue Found!

**The mobile app is pointing to production URL:**
```javascript
const API_BASE_URL = 'https://stayflow-x8is.onrender.com/api/';
```

**But you're running backend locally on port 3000!**

### Solution:

**Option 1: Point Mobile App to Local Backend**
```javascript
// mobile/src/api/api.js
const API_BASE_URL = 'http://192.168.1.17:3000/api/';
// or
const API_BASE_URL = 'http://192.168.0.114:3000/api/';
```

**Option 2: Deploy Backend to Render**
- Push code to GitHub
- Render will auto-deploy
- Mobile app will work with production URL

---

## 📝 Next Steps

1. **Decide:** Local testing or Production?

2. **If Local Testing:**
   - Change mobile app API URL to local IP
   - Restart Expo: `npm start` in mobile folder
   - Test sending bill to Ziya

3. **If Production:**
   - Deploy backend to Render
   - Check Render logs
   - Test from mobile app

4. **Verify WhatsApp Token:**
   - Check if token is valid
   - Generate new permanent token if needed

---

## 🆘 Still Not Working?

### Check These:

- [ ] Backend server running? (`netstat -ano | findstr :3000`)
- [ ] Mobile app API URL correct?
- [ ] API key matches in both places?
- [ ] WhatsApp token valid?
- [ ] Phone number format correct?
- [ ] Tenant exists in Google Sheets?
- [ ] Internet connection active?

### Get Detailed Logs:

**Backend:**
```bash
# Watch terminal output when you click "Send Bill"
# You should see API request logs
```

**Mobile App:**
```bash
# In Expo terminal, press 'j' to open debugger
# Check console for API errors
```

---

## ✅ Expected Behavior

When you click "Send Bill" for Ziya:

1. ✅ Mobile app shows loading indicator
2. ✅ API request sent to backend
3. ✅ Backend fetches Ziya's data
4. ✅ PDF invoice generated
5. ✅ Razorpay link created
6. ✅ WhatsApp message sent
7. ✅ Success message shown in mobile app
8. ✅ Ziya receives WhatsApp with invoice + payment link

---

**Current Status:** Backend is running, but mobile app needs to point to correct URL (local or production).
