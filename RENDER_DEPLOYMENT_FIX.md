# 🚨 Render Deployment Fix - Missing Environment Variables

## Error
```
❌ FATAL: Missing Required Environment Variables:
RAZORPAY_WEBHOOK_SECRET
WHATSAPP_APP_SECRET
JWT_SECRET
ADMIN_PASSWORD
ENCRYPTION_KEY
```

## Quick Fix - Add Environment Variables to Render

### Step 1: Go to Render Dashboard
1. Navigate to https://dashboard.render.com
2. Select your StayFlow service
3. Click **Environment** tab

### Step 2: Add Missing Variables

Copy and paste these into Render (replace with your actual values):

```bash
# Phase 2 Variables (if missing)
WHATSAPP_APP_SECRET=your_whatsapp_app_secret_from_meta_dashboard
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret_from_dashboard

# Phase 3 Variables (generate new)
JWT_SECRET=generate_with_command_below
ADMIN_PASSWORD=your_secure_admin_password
ENCRYPTION_KEY=generate_with_command_below
```

### Step 3: Generate Secrets

Run these commands locally to generate secure secrets:

```bash
# Generate JWT Secret
openssl rand -base64 64

# Generate Encryption Key
openssl rand -hex 32
```

### Step 4: Get WhatsApp & Razorpay Secrets

**WhatsApp App Secret:**
1. Go to https://developers.facebook.com
2. Select your WhatsApp Business App
3. Go to Settings → Basic
4. Copy the **App Secret**

**Razorpay Webhook Secret:**
1. Go to https://dashboard.razorpay.com
2. Navigate to Settings → Webhooks
3. If no webhook exists, create one:
   - URL: `https://your-render-url.onrender.com/webhook/razorpay`
   - Events: `payment.captured`, `payment_link.paid`
4. Copy the **Secret** shown

### Step 5: Add to Render

In Render Environment tab, add each variable:

```
Name: WHATSAPP_APP_SECRET
Value: [paste your WhatsApp app secret]

Name: RAZORPAY_WEBHOOK_SECRET
Value: [paste your Razorpay webhook secret]

Name: JWT_SECRET
Value: [paste generated JWT secret]

Name: ADMIN_PASSWORD
Value: [your secure password]

Name: ENCRYPTION_KEY
Value: [paste generated encryption key]
```

### Step 6: Save and Redeploy

1. Click **Save Changes**
2. Render will automatically redeploy
3. Wait for deployment to complete

---

## Alternative: Temporary Fix (Development Only)

If you need to deploy quickly for testing, you can temporarily make these optional. **NOT RECOMMENDED FOR PRODUCTION.**

### Option A: Use Default Values (INSECURE)

Edit `src/config.js` to add defaults:

```javascript
jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production',
adminPassword: process.env.ADMIN_PASSWORD || 'admin',
encryptionKey: process.env.ENCRYPTION_KEY || 'a'.repeat(64),
```

And update `requiredEnv` to remove these temporarily:

```javascript
const requiredEnv = [
    'MONGODB_URI',
    'GOOGLE_SHEET_ID',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_PRIVATE_KEY',
    'OWNER_PHONE',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    // Temporarily commented for initial deployment
    // 'RAZORPAY_WEBHOOK_SECRET',
    // 'WHATSAPP_APP_SECRET',
    // 'JWT_SECRET',
    // 'ADMIN_PASSWORD',
    // 'ENCRYPTION_KEY'
];
```

**⚠️ WARNING:** This is INSECURE and should only be used for initial testing. Add the real values immediately after.

---

## Verification

After adding variables and redeploying, check logs:

```
✅ All required environment variables configured
Server running on port 3000
```

If you see this, deployment was successful!

---

## Troubleshooting

### Still seeing "Missing Required Environment Variables"

**Cause:** Variables not saved or deployment didn't pick them up

**Solution:**
1. Verify variables are in Render Environment tab
2. Click "Manual Deploy" → "Clear build cache & deploy"
3. Wait for fresh deployment

### "Invalid JWT Secret" errors

**Cause:** JWT_SECRET is too short or invalid

**Solution:**
1. Regenerate: `openssl rand -base64 64`
2. Ensure no extra spaces or newlines
3. Update in Render and redeploy

### "Invalid Encryption Key" errors

**Cause:** ENCRYPTION_KEY is not 32 bytes hex

**Solution:**
1. Regenerate: `openssl rand -hex 32`
2. Should be exactly 64 characters (32 bytes in hex)
3. Update in Render and redeploy

### WhatsApp webhook signature verification fails

**Cause:** WHATSAPP_APP_SECRET is wrong

**Solution:**
1. Double-check value from Meta dashboard
2. Ensure no extra spaces
3. Update in Render and redeploy

### Razorpay webhook signature verification fails

**Cause:** RAZORPAY_WEBHOOK_SECRET is wrong

**Solution:**
1. Double-check value from Razorpay dashboard
2. Ensure webhook URL matches your Render URL
3. Update in Render and redeploy

---

## Complete Environment Variable Checklist

Make sure ALL of these are set in Render:

### Business Config
- [ ] `BUSINESS_NAME`
- [ ] `OWNER_PHONE`
- [ ] `OWNER_UPI_ID`
- [ ] `MONTHLY_RENT_DUE_DATE`
- [ ] `EB_DUE_DATE`
- [ ] `EB_UNIT_RATE`

### WhatsApp
- [ ] `WHATSAPP_TOKEN`
- [ ] `WHATSAPP_PHONE_NUMBER_ID`
- [ ] `WHATSAPP_VERIFY_TOKEN`
- [ ] `WHATSAPP_CALLBACK_URL`
- [ ] `WHATSAPP_APP_SECRET` ⚠️ NEW

### Google Sheets
- [ ] `GOOGLE_SHEET_ID`
- [ ] `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- [ ] `GOOGLE_PRIVATE_KEY`

### MongoDB
- [ ] `MONGODB_URI`

### Authentication & Security
- [ ] `JWT_SECRET` ⚠️ NEW
- [ ] `ADMIN_PASSWORD` ⚠️ NEW
- [ ] `ENCRYPTION_KEY` ⚠️ NEW

### Razorpay
- [ ] `RAZORPAY_KEY_ID`
- [ ] `RAZORPAY_KEY_SECRET`
- [ ] `RAZORPAY_WEBHOOK_SECRET` ⚠️ NEW

### Optional
- [ ] `GEMINI_API_KEY`
- [ ] `GROQ_API_KEY`
- [ ] `GOOGLE_MAPS_API_KEY`
- [ ] `RENDER_API_URL`
- [ ] `ALLOWED_ORIGINS`

---

## Quick Copy-Paste Template

Use this template in Render (fill in your values):

```
WHATSAPP_APP_SECRET=
RAZORPAY_WEBHOOK_SECRET=
JWT_SECRET=
ADMIN_PASSWORD=
ENCRYPTION_KEY=
```

Generate secrets:
```bash
# Run these commands and paste the output above
echo "JWT_SECRET=$(openssl rand -base64 64)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

---

## Need Help?

1. **Check Render Logs:**
   - Render Dashboard → Logs tab
   - Look for specific error messages

2. **Verify Variable Format:**
   - No extra spaces before/after values
   - No quotes around values in Render UI
   - Multi-line values (like GOOGLE_PRIVATE_KEY) should work as-is

3. **Test Locally First:**
   - Add variables to `.env` file
   - Run `npm start`
   - If it works locally, same values should work on Render

---

**Status: Follow steps above to fix deployment** ✅
