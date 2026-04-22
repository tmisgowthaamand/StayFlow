# ✅ StayFlow System - Ready to Use!

## 🎉 All Systems Running

### ✅ Backend Server (Port 3000)
```
✅ Google Gemini AI initialized
✅ Dashboard found and serving
✅ Razorpay initialized for payment orders
⚠️ WhatsApp Web.js disabled (using Cloud API only)
✅ MongoDB connected
✅ Keep-alive service started
✅ Server running on port 3000
```

### ✅ Mobile App (Expo - Port 8081)
```
✅ Metro Bundler running
✅ QR code available for scanning
✅ Connected to local backend (http://192.168.0.114:3000/api/)
✅ Error boundary added for better debugging
```

---

## 📱 How to Use the Mobile App

### 1. **Open Expo Go on Your Phone**
- Scan the QR code from terminal
- Or enter: `exp://192.168.0.114:8081`

### 2. **Login to the App**
- Use your admin credentials
- App will load the dashboard

### 3. **Send Bill to a Resident (e.g., Ziya)**

**Step-by-Step:**
1. Open the app
2. Go to **"Residents"** tab
3. Find **Ziya** in the list
4. Tap the **Bell/Send icon** (📤 or 🔔)
5. Confirm the action

**What Happens:**
1. ✅ Mobile app sends API request to backend
2. ✅ Backend fetches Ziya's data from Google Sheets
3. ✅ PDF invoice is generated
4. ✅ Razorpay payment link is created
5. ✅ WhatsApp message sent via Cloud API
6. ✅ Ziya receives WhatsApp with:
   - Invoice PDF
   - Payment link
   - Payment buttons (UPI/Cash)

---

## 🔍 Monitoring

### Watch Backend Logs:
The terminal running the backend will show:
```
Incoming: 919876543210 | Body: ...
Message sent successfully to 919876543210
```

### Watch Mobile App Logs:
The Expo terminal will show API requests and responses.

---

## ⚠️ Important Notes

### WhatsApp Web.js Disabled
- **Reason:** Chrome/Chromium not installed
- **Impact:** None! Cloud API works perfectly
- **Benefit:** Faster startup, no browser overhead

### Cloud API Requirements
Make sure these are set in `.env`:
```env
WHATSAPP_TOKEN=your_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
```

### Mobile App Configuration
- **API URL:** `http://192.168.0.114:3000/api/`
- **API Key:** `stayflow_dev_key_123`
- **Network:** Same WiFi as backend server

---

## 🧪 Testing the System

### Test 1: Send Bill to Ziya

1. Open mobile app
2. Go to Residents
3. Find Ziya
4. Tap Send icon
5. Check backend terminal for logs
6. Verify Ziya receives WhatsApp message

### Test 2: Send to All Residents

1. Open mobile app
2. Go to Dashboard or Residents
3. Tap "Notify All" button
4. Confirm action
5. Watch backend send messages to all residents

### Test 3: Mark as Paid

1. Open mobile app
2. Go to Residents
3. Find a resident
4. Tap "Mark as Paid"
5. Enter amount and mode
6. Verify invoice is sent

---

## 🔧 Troubleshooting

### Issue: "Network Error" in Mobile App

**Cause:** Backend not running or wrong URL

**Fix:**
```bash
# Check if backend is running
netstat -ano | findstr :3000

# If not running, start it
npm start
```

### Issue: "Unauthorized" Error

**Cause:** API key mismatch

**Fix:**
Check `.env` file:
```env
ADMIN_API_KEY=stayflow_dev_key_123
```

### Issue: WhatsApp Message Not Sent

**Possible Causes:**
1. ❌ WhatsApp token expired
2. ❌ Phone number not on WhatsApp
3. ❌ 24-hour window expired

**Check Backend Logs:**
Look for error messages like:
- "WHATSAPP_TOKEN HAS EXPIRED"
- "Error sending message"

**Fix:**
1. Generate new permanent token from Meta Developer Console
2. Update `.env`: `WHATSAPP_TOKEN=new_token`
3. Restart backend

---

## 📊 System Architecture

```
Mobile App (Expo)
    ↓
API Request (http://192.168.0.114:3000/api/)
    ↓
Backend Server (Port 3000)
    ↓
├─ Google Sheets (Tenant Data)
├─ MongoDB (Logs & Notifications)
├─ Razorpay (Payment Links)
└─ WhatsApp Cloud API (Messages)
    ↓
WhatsApp Message Delivered
```

---

## 🚀 Quick Commands

### Start Backend:
```bash
npm start
```

### Start Mobile App:
```bash
cd mobile
npm start
```

### Stop All:
```bash
# Press Ctrl+C in both terminals
```

### Restart Backend:
```bash
# Press Ctrl+C
npm start
```

### Clear Expo Cache:
```bash
cd mobile
npx expo start --clear
```

---

## ✅ Checklist

Before sending bills, verify:

- [ ] Backend running on port 3000
- [ ] Expo running on port 8081
- [ ] Mobile app connected to backend
- [ ] WhatsApp token valid in `.env`
- [ ] Google Sheets accessible
- [ ] MongoDB connected
- [ ] Razorpay configured

---

## 📱 Mobile App Features

### Dashboard
- View statistics
- Quick actions
- Recent activity

### Residents
- View all residents
- Send bills individually
- Mark as paid
- Edit tenant details
- Delete tenants

### Rooms
- View rooms by location
- Split EB bills
- View occupancy

### Billing
- View pending payments
- Send reminders
- Generate invoices

### Registrations
- View new registrations
- Approve/reject

---

## 🎯 Next Steps

1. **Test sending a bill to Ziya**
   - Open mobile app
   - Go to Residents
   - Tap Send for Ziya
   - Verify WhatsApp message received

2. **Check backend logs**
   - Watch terminal for success messages
   - Look for any errors

3. **Verify invoice generation**
   - Check `uploads/` folder for PDF
   - Verify Razorpay link works

4. **Test payment flow**
   - Click payment link
   - Complete test payment
   - Verify status updates

---

## 🆘 Need Help?

### Backend Not Starting?
```bash
# Check for port conflicts
netstat -ano | findstr :3000

# Kill process if needed
taskkill /PID <process_id> /F

# Restart
npm start
```

### Mobile App Not Connecting?
```bash
# Check API URL in mobile/src/api/api.js
# Should be: http://192.168.0.114:3000/api/

# Restart Expo
cd mobile
npx expo start --clear
```

### WhatsApp Not Sending?
```bash
# Check .env file
cat .env | grep WHATSAPP

# Verify token is valid
# Generate new token if needed from Meta Developer Console
```

---

## 📞 Support

If you encounter issues:

1. Check backend terminal for error logs
2. Check Expo terminal for API errors
3. Verify all environment variables in `.env`
4. Ensure same WiFi network for mobile and backend
5. Check WhatsApp token validity

---

**System Status:** ✅ READY
**Last Updated:** April 22, 2026
**Version:** 1.0.0
