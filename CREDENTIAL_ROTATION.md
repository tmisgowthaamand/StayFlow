# Credential Rotation Checklist

🚨 **URGENT**: All credentials below were exposed in the public GitHub repository and MUST be rotated immediately.

## Rotation Steps (Complete in Order)

### 1. MongoDB Atlas
- **Action**: Change password for user `stayflow`
- **Location**: https://cloud.mongodb.com
- **Steps**:
  1. Navigate to Database Access
  2. Edit user `stayflow`
  3. Generate new password
  4. Update `MONGODB_URI` in `.env` with new credentials
- **Priority**: CRITICAL

### 2. WhatsApp Cloud API
- **Action**: Generate new permanent access token
- **Location**: https://developers.facebook.com
- **Steps**:
  1. Go to your WhatsApp Business App
  2. Navigate to WhatsApp > API Setup
  3. Generate new permanent token
  4. Update `WHATSAPP_TOKEN` in `.env`
  5. Optionally regenerate `WHATSAPP_APP_SECRET`
- **Priority**: CRITICAL

### 3. Razorpay
- **Action**: Regenerate API keys
- **Location**: https://dashboard.razorpay.com
- **Steps**:
  1. Go to Settings > API Keys
  2. Regenerate Key ID and Key Secret
  3. Update `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `.env`
  4. Go to Settings > Webhooks
  5. Regenerate webhook secret
  6. Update `RAZORPAY_WEBHOOK_SECRET` in `.env`
- **Priority**: CRITICAL (financial access)

### 4. Google Cloud Service Account
- **Action**: Delete and recreate service account key
- **Location**: https://console.cloud.google.com
- **Steps**:
  1. Navigate to IAM & Admin > Service Accounts
  2. Find your service account
  3. Delete ALL existing keys
  4. Create new JSON key
  5. Download as `service-account.json` (DO NOT COMMIT)
  6. Update `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` in `.env`
- **Priority**: CRITICAL

### 5. Google Gemini API
- **Action**: Regenerate API key
- **Location**: https://aistudio.google.com/apikey
- **Steps**:
  1. Delete existing API key
  2. Create new API key
  3. Update `GEMINI_API_KEY` in `.env`
- **Priority**: HIGH

### 6. Groq API
- **Action**: Regenerate API key
- **Location**: https://console.groq.com
- **Steps**:
  1. Go to API Keys section
  2. Delete existing key
  3. Create new API key
  4. Update `GROQ_API_KEY` in `.env`
- **Priority**: HIGH

### 7. Google Maps API
- **Action**: Regenerate API key and add restrictions
- **Location**: https://console.cloud.google.com/apis/credentials
- **Steps**:
  1. Delete existing API key
  2. Create new API key
  3. Add HTTP referrer restrictions (your domain only)
  4. Update `GOOGLE_MAPS_API_KEY` in `.env`
- **Priority**: HIGH

### 8. Admin API Key
- **Action**: Generate new random key
- **Command**: `openssl rand -hex 32`
- **Steps**:
  1. Run the command above to generate a secure random key
  2. Update `ADMIN_API_KEY` in `.env`
  3. Update dashboard environment variables with same key
- **Priority**: CRITICAL

## Post-Rotation Verification

After rotating all credentials:

1. ✅ Test MongoDB connection
2. ✅ Test WhatsApp message sending
3. ✅ Test Razorpay payment flow
4. ✅ Test Google Sheets read/write
5. ✅ Test AI service responses
6. ✅ Test admin dashboard login
7. ✅ Verify all services are operational

## Security Best Practices Going Forward

- ✅ Never commit `.env` or `service-account.json`
- ✅ Use environment variables in CI/CD (GitHub Secrets, Render env vars)
- ✅ Rotate credentials every 90 days
- ✅ Use API key restrictions where available
- ✅ Monitor API usage for anomalies
- ✅ Enable 2FA on all service accounts

## Timeline

- **Immediate (0-2 hours)**: Rotate items 1-4, 8
- **Within 24 hours**: Rotate items 5-7
- **Within 48 hours**: Complete post-rotation verification
