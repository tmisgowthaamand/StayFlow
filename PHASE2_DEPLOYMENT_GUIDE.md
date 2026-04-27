# Phase 2 Deployment Guide

## 🚨 CRITICAL: New Required Environment Variables

Phase 2 introduces **2 new REQUIRED environment variables**. The application will **FAIL TO START** if these are not configured.

---

## Required Actions Before Deployment

### 1. WhatsApp App Secret

**Variable:** `WHATSAPP_APP_SECRET`

**Where to find it:**
1. Go to https://developers.facebook.com
2. Navigate to your WhatsApp Business App
3. Go to **App Settings** → **Basic**
4. Copy the **App Secret** value

**Add to:**
- `.env` file (local): `WHATSAPP_APP_SECRET=your_app_secret_here`
- Render Dashboard: Environment Variables section

---

### 2. Razorpay Webhook Secret

**Variable:** `RAZORPAY_WEBHOOK_SECRET`

**Where to find it:**
1. Go to https://dashboard.razorpay.com
2. Navigate to **Settings** → **Webhooks**
3. If you don't have a webhook configured:
   - Click **Create Webhook**
   - URL: `https://your-domain.com/webhook/razorpay`
   - Events: Select `payment.captured` and `payment_link.paid`
   - Click **Create**
4. Copy the **Secret** value shown

**Add to:**
- `.env` file (local): `RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here`
- Render Dashboard: Environment Variables section

---

## Updated .env.example

Your `.env.example` already includes these variables. Here's the relevant section:

```env
# ── WhatsApp Cloud API ──
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_VERIFY_TOKEN=your_verify_token
WHATSAPP_CALLBACK_URL=https://your-domain.com/webhook
WHATSAPP_APP_SECRET=your_app_secret_for_webhook_verification  # ← NEW (REQUIRED)

# ── Razorpay ──
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret  # ← NEW (REQUIRED)
```

---

## Deployment Steps

### For Render.com (Production)

1. **Go to Render Dashboard**
   - Navigate to your StayFlow service
   - Click **Environment** tab

2. **Add New Variables**
   ```
   WHATSAPP_APP_SECRET = [paste your app secret]
   RAZORPAY_WEBHOOK_SECRET = [paste your webhook secret]
   ```

3. **Save Changes**
   - Render will automatically redeploy with new variables

4. **Verify Deployment**
   - Check logs for: `✅ All required environment variables configured`
   - Should NOT see: `❌ FATAL: Missing Required Environment Variables`

### For Local Development

1. **Update .env file**
   ```bash
   # Add these two lines to your .env file
   WHATSAPP_APP_SECRET=your_app_secret_here
   RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
   ```

2. **Restart Server**
   ```bash
   npm start
   ```

3. **Verify Startup**
   - Server should start without errors
   - Check for required env validation messages

---

## Breaking Changes

### 1. API Key Query String Support Removed

**Before Phase 2:**
```
GET /api/tenants?key=stayflow_dev_key_123  ✅ Worked
```

**After Phase 2:**
```
GET /api/tenants?key=stayflow_dev_key_123  ❌ Fails (401 Unauthorized)
```

**New Required Format:**
```
GET /api/tenants
Headers:
  x-api-key: stayflow_dev_key_123  ✅ Works
```

**Action Required:**
- Update any scripts or tools that use query string API keys
- Use header-based authentication only

---

### 2. File Downloads Now Require Authentication

**Before Phase 2:**
```
GET /api/uploads/invoice_123.pdf  ✅ Anyone could access
```

**After Phase 2:**
```
GET /api/uploads/invoice_123.pdf
Headers:
  x-api-key: your_admin_key  ✅ Required
```

**Action Required:**
- Update any direct file links to include authentication
- Dashboard already handles this automatically

---

### 3. Rate Limiting Changes

**New Rate Limits:**
- Public endpoints (`/api/public/register`, `/api/submit-query`, `/api/submit-vacate`): **10 requests/hour per IP**
- Admin endpoints: **1000 requests/15min per IP** (no bypass)

**Action Required:**
- None for normal usage
- High-volume integrations may need adjustment

---

## Testing Checklist

After deployment, verify:

### WhatsApp Webhook
```bash
# Send a test message to your WhatsApp bot
# Check logs for:
✅ Webhook signature verified
❌ Should NOT see: "Missing signature header" or "Signature verification failed"
```

### Razorpay Webhook
```bash
# Make a test payment
# Check logs for:
✅ Webhook signature verified
❌ Should NOT see: "Invalid signature"
```

### File Authentication
```bash
# Try accessing a file without auth (should fail)
curl https://your-domain.com/api/uploads/test.pdf
# Expected: 401 Unauthorized

# Try with auth (should work)
curl -H "x-api-key: your_key" https://your-domain.com/api/uploads/test.pdf
# Expected: File download
```

### Invoice Generation
```bash
# Try without auth (should fail)
curl -X POST https://your-domain.com/api/generate-invoice \
  -H "Content-Type: application/json" \
  -d '{"phone":"919876543210"}'
# Expected: 401 Unauthorized

# Try with auth (should work)
curl -X POST https://your-domain.com/api/generate-invoice \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_key" \
  -d '{"phone":"919876543210"}'
# Expected: Invoice generated
```

---

## Rollback Plan

If issues occur after deployment:

1. **Immediate Rollback:**
   ```bash
   git revert HEAD~2  # Reverts Phase 2 commits
   git push --force
   ```

2. **Remove New Env Variables:**
   - Remove `WHATSAPP_APP_SECRET` from Render
   - Remove `RAZORPAY_WEBHOOK_SECRET` from Render

3. **Redeploy Previous Version:**
   - Render will auto-deploy the reverted code

---

## Support

If you encounter issues:

1. **Check Logs:**
   - Render Dashboard → Logs tab
   - Look for startup errors or webhook failures

2. **Verify Environment Variables:**
   - Render Dashboard → Environment tab
   - Ensure both new variables are set

3. **Test Webhooks:**
   - Use webhook testing tools to verify signatures
   - Check Meta and Razorpay webhook logs

---

## Summary

✅ **2 new required environment variables**
✅ **All security vulnerabilities fixed**
✅ **No database schema changes**
✅ **No breaking changes to core functionality**
⚠️ **API key query string support removed (use headers)**
⚠️ **File downloads now require authentication**

**Estimated Deployment Time:** 5-10 minutes
**Downtime Required:** None (rolling deployment)
