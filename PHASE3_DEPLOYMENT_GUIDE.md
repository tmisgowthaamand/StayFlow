# Phase 3 Deployment Guide

## 🚨 CRITICAL: New Required Environment Variables

Phase 3 introduces **3 new REQUIRED environment variables**. The application will **FAIL TO START** if these are not configured.

---

## Step 1: Generate Secure Secrets

### JWT Secret (Required)
```bash
openssl rand -base64 64
```
Example output: `xK9mP2vN8qR5tY7wZ3aB6cD1eF4gH8iJ0kL2mN5oP7qR9sT1uV3wX6yZ8aB0cD2e...`

### Encryption Key (Required)
```bash
openssl rand -hex 32
```
Example output: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2`

### Admin Password (Required)
Use a password manager to generate a strong password (minimum 12 characters, mix of letters, numbers, symbols).

Example: `Xy9#mK2$pL5@nQ8!`

---

## Step 2: Update Environment Variables

### For Render.com (Production)

1. **Go to Render Dashboard**
   - Navigate to your StayFlow service
   - Click **Environment** tab

2. **Add New Variables**
   ```
   JWT_SECRET = [paste your JWT secret from Step 1]
   ADMIN_PASSWORD = [paste your admin password from Step 1]
   ENCRYPTION_KEY = [paste your encryption key from Step 1]
   ```

3. **Verify Existing Variables**
   Ensure these from Phase 2 are still set:
   ```
   WHATSAPP_APP_SECRET = [your WhatsApp app secret]
   RAZORPAY_WEBHOOK_SECRET = [your Razorpay webhook secret]
   ```

4. **Save Changes**
   - Render will automatically redeploy with new variables

### For Local Development

1. **Update .env file**
   ```bash
   # Add these three lines to your .env file
   JWT_SECRET=your_jwt_secret_here
   ADMIN_PASSWORD=your_admin_password_here
   ENCRYPTION_KEY=your_encryption_key_here
   ```

2. **Restart Server**
   ```bash
   npm start
   ```

---

## Step 3: Test Authentication

### Dashboard Login

1. **Open Dashboard**
   - Navigate to `https://your-dashboard.vercel.app`

2. **Login**
   - Username: `admin`
   - Password: [your ADMIN_PASSWORD from Step 1]

3. **Verify**
   - Should redirect to dashboard
   - Check browser localStorage for `stayflow_token`
   - Token should be a JWT (3 parts separated by dots)

### Mobile App Login

1. **Open Mobile App**
   - Launch the StayFlow mobile app

2. **Login**
   - Username: `admin`
   - Password: [your ADMIN_PASSWORD from Step 1]

3. **Verify**
   - Should navigate to main screen
   - Check AsyncStorage for `stayflow_jwt`

---

## Step 4: Verify Security Features

### Test Input Validation

```bash
# Should return 400 with validation errors
curl -X POST https://your-domain.com/api/public/register \
  -H "Content-Type: application/json" \
  -d '{"name":"123","phone":"abc","room":"A1"}'

# Expected response:
{
  "error": "Validation failed",
  "details": [
    "\"name\" with value \"123\" fails to match the required pattern: /^[a-zA-Z\\s.'-]+$/",
    "\"phone\" with value \"abc\" fails to match the required pattern: /^\\d{10,15}$/"
  ]
}
```

### Test JWT Authentication

```bash
# Without token (should fail)
curl https://your-domain.com/api/tenants
# Expected: 401 Unauthorized

# With token (should work)
curl https://your-domain.com/api/tenants \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Expected: List of tenants
```

### Test Error Messages

```bash
# Trigger an error (e.g., invalid phone)
curl -X POST https://your-domain.com/api/generate-invoice \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"invalid"}'

# Expected response (generic error, no stack trace):
{
  "error": "Internal server error"
}
```

### Test Backup to Google Drive

```bash
# Check server logs after 3:00 AM (backup cron time)
# Should see:
[BACKUP] Uploaded to Drive: <file_id> (backup-2026-04-27.json)
```

---

## Step 5: Update Client Applications

### Dashboard (Already Done)
- Dashboard was rebuilt in Task 8
- No action required

### Mobile App
- Mobile app code was updated in Task 1
- **Action Required:** Rebuild and redeploy mobile app
  ```bash
  cd mobile
  eas build --platform all
  ```

---

## Breaking Changes & Migration

### 1. Login Credentials Changed

**Old:**
- Username: `admin`
- Password: `admin` (hardcoded)

**New:**
- Username: `admin`
- Password: [your ADMIN_PASSWORD environment variable]

**Action:** Inform all users of the new password

### 2. API Authentication Method Changed

**Old:**
```
Headers: x-api-key: stayflow_dev_key_123
```

**New:**
```
Headers: Authorization: Bearer <jwt_token>
```

**Action:** Update any external scripts or integrations

### 3. Session Persistence

**Old:**
- Dashboard: sessionStorage/localStorage with boolean flag
- Mobile: AsyncStorage with dummy token

**New:**
- Dashboard: localStorage with JWT token (24h expiry)
- Mobile: AsyncStorage with JWT token (24h expiry)

**Action:** Users will need to re-login after deployment

---

## Troubleshooting

### Error: "Missing Required Environment Variables"

**Cause:** JWT_SECRET, ADMIN_PASSWORD, or ENCRYPTION_KEY not set

**Solution:**
1. Check Render environment variables
2. Ensure all 3 new variables are set
3. Redeploy service

### Error: "Invalid credentials" on login

**Cause:** Wrong password or JWT_SECRET mismatch

**Solution:**
1. Verify ADMIN_PASSWORD is set correctly
2. Ensure JWT_SECRET is the same across all instances
3. Clear browser localStorage and try again

### Error: "Invalid or expired token"

**Cause:** JWT token expired (24h) or JWT_SECRET changed

**Solution:**
1. Logout and login again
2. Check JWT_SECRET hasn't changed
3. Clear browser/app storage

### Dashboard shows blank page after login

**Cause:** Old dashboard dist with hardcoded credentials

**Solution:**
1. Rebuild dashboard: `cd dashboard && npm run build`
2. Redeploy dashboard to Vercel
3. Clear browser cache

### Mobile app can't login

**Cause:** Old mobile app with hardcoded API key

**Solution:**
1. Rebuild mobile app with updated code
2. Publish new version to app stores
3. Users must update to new version

---

## Rollback Plan

If critical issues occur:

### Option 1: Rollback Code Only
```bash
git revert HEAD~8  # Reverts all Phase 3 commits
git push --force
```

### Option 2: Rollback Environment Variables
1. Remove JWT_SECRET, ADMIN_PASSWORD, ENCRYPTION_KEY from Render
2. Redeploy previous version
3. Users can login with old credentials

### Option 3: Full Rollback
1. Rollback code (Option 1)
2. Rollback environment variables (Option 2)
3. Rebuild dashboard with old code
4. Redeploy mobile app with old code

---

## Post-Deployment Verification

### Checklist

- [ ] Server starts without errors
- [ ] Dashboard login works with new password
- [ ] Mobile app login works with new password
- [ ] JWT tokens are issued and validated
- [ ] Input validation returns 400 errors
- [ ] Error messages are generic (no stack traces)
- [ ] Backups upload to Google Drive
- [ ] Graceful shutdown works (test with SIGTERM)
- [ ] All API endpoints require authentication
- [ ] No hardcoded credentials in dashboard dist
- [ ] No hardcoded credentials in mobile app

### Monitoring

**Watch for:**
- 401 errors (authentication failures)
- 400 errors (validation failures)
- 500 errors (should be rare, check logs)
- Backup success messages in logs
- JWT token expiry issues

**Metrics to Track:**
- Login success rate
- API authentication failures
- Validation error rate
- Backup success rate
- Server uptime

---

## Security Best Practices

### Password Management

1. **Store ADMIN_PASSWORD securely**
   - Use a password manager
   - Don't share via email/chat
   - Rotate every 90 days

2. **Store JWT_SECRET securely**
   - Never commit to Git
   - Don't share with anyone
   - Rotate if compromised

3. **Store ENCRYPTION_KEY securely**
   - Keep separate from JWT_SECRET
   - Backup securely (needed to decrypt data)
   - Rotate carefully (requires data re-encryption)

### Access Control

1. **Limit who has access to:**
   - Render environment variables
   - Production database
   - Google Drive backups
   - Server logs

2. **Enable 2FA on:**
   - Render account
   - MongoDB Atlas account
   - Google Cloud account
   - Vercel account

### Monitoring

1. **Set up alerts for:**
   - Failed login attempts (>5 in 1 hour)
   - 500 errors (>10 in 1 hour)
   - Backup failures
   - Server downtime

2. **Review logs regularly:**
   - Authentication failures
   - Validation errors
   - API usage patterns
   - Backup success

---

## Summary

### New Environment Variables (3)
- `JWT_SECRET` - For JWT token signing
- `ADMIN_PASSWORD` - For admin authentication
- `ENCRYPTION_KEY` - For data encryption

### Breaking Changes (3)
- Login credentials changed
- API authentication method changed
- Session persistence changed

### Deployment Steps (5)
1. Generate secure secrets
2. Update environment variables
3. Test authentication
4. Verify security features
5. Update client applications

### Estimated Deployment Time
- **Preparation:** 15 minutes
- **Deployment:** 10 minutes
- **Testing:** 15 minutes
- **Total:** 40 minutes

### Downtime Required
- **None** (rolling deployment)
- Users will need to re-login after deployment

---

## Support

If you encounter issues:

1. **Check Logs:**
   - Render Dashboard → Logs tab
   - Look for startup errors or authentication failures

2. **Verify Environment Variables:**
   - Render Dashboard → Environment tab
   - Ensure all 3 new variables are set

3. **Test Locally:**
   - Set environment variables in .env
   - Run `npm start`
   - Test login flow

4. **Contact Support:**
   - Include error messages from logs
   - Include steps to reproduce
   - Include environment variable names (not values!)

---

**Status: Ready for Deployment** ✅
