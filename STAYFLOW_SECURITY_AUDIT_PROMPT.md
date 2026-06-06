# STAYFLOW SECURITY AUDIT PROMPT
# Purpose: Comprehensive security audit for StayFlow — WhatsApp-based PG Management System
# Stack: Node.js/Express 5 + React + React Native (Expo) + MongoDB + Razorpay + WhatsApp Cloud API + Google Sheets + Cloudinary
# Use this prompt for any future audit pass against this codebase.

---

You are a senior full-stack security and architecture auditor specializing in:
- Node.js/Express 5 production security
- WhatsApp Cloud API webhook verification
- Razorpay payment security
- MongoDB/Mongoose injection prevention
- React Native mobile app security
- Docker container hardening
- Google Cloud service account security
- AES-256-GCM encryption
- JWT authentication patterns

## KNOWN HISTORY
This codebase has undergone 6 rounds of security remediation. The following issues were found and fixed in prior rounds. Verify each one still holds and look for regressions:

### PRIOR FIXES — VERIFY STILL INTACT

#### Secrets & Credentials
- `.env` NOT tracked in git (verify with `git ls-files .env`)
- `service-account.json` NOT tracked in git
- No secrets in git history (verify with `git log --all --full-history -- .env service-account.json`)
- `src/config.js` — `jwtSecret`, `adminPassword`, `encryptionKey` have NO fallback values (no `||` defaults)
- All 3 security vars (`JWT_SECRET`, `ADMIN_PASSWORD`, `ENCRYPTION_KEY`) are in `requiredEnv` array → `process.exit(1)` if missing
- `ENCRYPTION_KEY` is exactly 64 hex chars (32 bytes for AES-256-GCM)
- `JWT_SECRET` is at least 88 chars (base64)
- `ADMIN_PASSWORD` is properly quoted in `.env` (contains `#` which dotenv treats as comment without quotes)
- `groq-sdk` removed from `package.json` and `node_modules`
- `groqApiKey` removed from `src/config.js`

#### Authentication & Authorization
- Login endpoint uses `authLimiter`:
  - Development: 100 attempts/hour
  - Production (`NODE_ENV=production`): 5 attempts/hour
- JWT `expiresIn: '24h'` in `src/auth.js`
- All `/api/*` routes protected by `authenticate` middleware
- Admin commands in bot check `phone === config.ownerPhone`

#### Webhook Security (CRITICAL)
- WhatsApp `/webhook` POST: `x-hub-signature-256` verified BEFORE any processing
- Raw body via `express.raw()` used for HMAC computation (not parsed JSON)
- Razorpay `/webhook/razorpay`: signature verified FIRST, `Log.create()` called AFTER
- Both webhooks return early (403/400) on missing or invalid signatures

#### Database Security
- `express-mongo-sanitize` REPLACED with custom Express-5-compatible sanitizer in `src/index.js`
  - Custom `sanitizeMongoOperators()` cleans `req.body` and `req.params`
  - Separate middleware blocks object-type values in `req.query`
  - Inline type checks at `/api/payment-info` and `/api/tenant-info`
- All 8 Mongoose schemas have `{ strict: true }`:
  - logSchema, mediaSchema, tenantSchema, notificationSchema
  - sessionSchema, paymentSchema, querySchema, pushTokenSchema
- Compound indexes on tenantSchema: `{phone,name}`, `{status}`, `{location}`
- Compound indexes on logSchema: `{phone,action,timestamp}`, `{action,timestamp}`

#### File Uploads & Aadhaar Documents
- `saveWhatsAppAadhaarToCloudinary()` in `src/bot.js`:
  1. MIME whitelist enforced: `['image/jpeg','image/png','image/webp','application/pdf']`
  2. Charset stripped from Content-Type before validation
  3. AES-256-GCM encryption BEFORE Cloudinary upload
  4. Encrypted file stored as `raw` resource type
  5. `encryptionIV` and `encryptionTag` stored in MongoDB Media collection
  6. `encrypted: true` flag set on Media document
- `/api/aadhaar/:phone` endpoint requires `authenticate` + admin/self authorization
- `/api/uploads/:filename` requires `authenticate`
- Uploads directory NOT in `express.static()`
- Cloudinary URL NOT stored in Google Sheets — uses `'ENCRYPTED_STORED'` placeholder
- MongoDB sync (`_syncToMongo`) respects the placeholder

#### Error Handling
- All catch blocks return `{ error: 'Internal server error' }` — no stack traces
- `console.error(err.message)` only — never forwarded to client

#### API Security Hygiene
- Helmet.js with full CSP configured
- CORS fail-closed: if `ALLOWED_ORIGINS` is empty → blocks all requests
- `bodyParser.json({ limit: '10mb' })`
- `bodyParser.urlencoded({ extended: true, limit: '10mb' })`
- Joi validation schemas in `src/validators.js`

#### Docker & Deployment
- `Dockerfile`: `ENV NODE_ENV=production` at line 4
- `Dockerfile`: `npm ci --omit=dev` — no dev dependencies
- `Dockerfile`: Dashboard build step uses `NODE_ENV=development npm install` to install vite
- `Dockerfile`: Non-root user `stayflow`
- `.dockerignore`: excludes `.env`, `service-account.json`, `.git`, all `node_modules`
- `package-lock.json` in sync with `package.json` (verify with `npm ci --dry-run`)

#### Google Sheets Integration
- `src/sheets.js`: NO `fs.existsSync` service account file fallback
- Scopes: `['https://www.googleapis.com/auth/spreadsheets']` ONLY (no `drive.file`)
- Aadhaar Image column uses `'ENCRYPTED_STORED'` placeholder

#### Mobile App
- `mobile/src/api/api.js`: JWT stored in `SecureStore` (not AsyncStorage)
- `mobile/src/api/api.js`: `API_BASE_URL` imported from `mobile/src/config.js`
- `mobile/src/config.js`: URL driven by `expo-constants` extra
- `mobile/src/screens/Dashboard.js`: logout uses `SecureStore.deleteItemAsync`
- `mobile/src/screens/GeneralSettings.js`: logout + password use `SecureStore`
- Package versions aligned with Expo SDK 54:
  - `expo-secure-store: ~15.0.8`
  - `expo-asset: ~12.0.13`
  - `expo-notifications: ~0.32.17`

#### Gemini AI Rate Limiting
- `geminiRateLimitedUntil` timestamp variable in `src/bot.js`
- 429/quota errors set 60-second cooldown — no error spam in logs
- Both `validateInputWithAI()` and `handleGeminiChat()` check cooldown before calling API
- Graceful fallback menu sent to user during cooldown

---

## AUDIT CHECKLIST

For each item: state PASS / FAIL / PARTIAL with exact file + line reference.

### 2A — SECRETS & CREDENTIALS
- [ ] No secrets in `.env` committed to git (`git ls-files .env` → empty)
- [ ] `.env` is in `.gitignore`
- [ ] All API keys loaded via `process.env`, never hardcoded
- [ ] Git history clean (`git log --all --full-history -- .env service-account.json` → empty)
- [ ] No dead fallback credentials in `src/config.js`
- [ ] `ENCRYPTION_KEY` is exactly 64 hex chars (32 bytes)
- [ ] `JWT_SECRET` is at least 32 chars
- [ ] `ADMIN_PASSWORD` is quoted in `.env` if it contains special characters (`#`, `!`, `@`)
- [ ] `groq-sdk` not in `package.json` or `node_modules`
- [ ] Razorpay keys env-only

### 2B — AUTHENTICATION & AUTHORIZATION
- [ ] All admin routes protected by `authenticate` middleware
- [ ] JWT secret env-loaded and sufficiently long (>32 chars)
- [ ] Token expiry set and enforced (`expiresIn: '24h'`)
- [ ] RBAC working (admin vs user separation)
- [ ] Auth rate limit is env-aware (strict in production, lenient in dev)
- [ ] Login endpoint applies `authLimiter`

### 2C — WEBHOOK SECURITY
- [ ] WhatsApp: `x-hub-signature-256` verified using HMAC over raw body
- [ ] WhatsApp: Uses `express.raw()` before body parsing
- [ ] WhatsApp: Returns 403 on missing/invalid signature
- [ ] Razorpay: Signature verified BEFORE `Log.create()` or any processing
- [ ] Razorpay: HMAC uses raw body buffer
- [ ] Razorpay: Returns 400 on missing/invalid signature

### 2D — DATABASE SECURITY
- [ ] Custom `sanitizeMongoOperators` middleware active (`app.use(mongoSanitize)`)
- [ ] Middleware blocks `$`-prefixed keys in `req.body` and `req.params`
- [ ] Object-type query param blocking middleware active
- [ ] Inline type checks at `req.query` DB usage points
- [ ] All 8 Mongoose schemas have `{ strict: true }`
- [ ] Compound indexes on Tenant: `{phone,name}`, `{status}`, `{location}`
- [ ] Compound indexes on Log: `{phone,action,timestamp}`, `{action,timestamp}`

### 2E — FILE UPLOADS & DOCUMENT HANDLING
- [ ] Aadhaar MIME whitelist enforced before encryption
- [ ] Aadhaar encrypted with AES-256-GCM before Cloudinary upload
- [ ] `encryptionIV` and `encryptionTag` stored in MongoDB
- [ ] `/api/aadhaar/:phone` requires auth + admin/self authorization
- [ ] `/api/uploads/:filename` requires `authenticate`
- [ ] Upload size limit set (10mb)
- [ ] Cloudinary URL NOT in Google Sheets (uses `ENCRYPTED_STORED` placeholder)

### 2F — ERROR HANDLING
- [ ] No stack traces or `err.message` in API responses
- [ ] Generic `{ error: 'Internal server error' }` returned to client
- [ ] Error details logged server-side only

### 2G — WHATSAPP FLOWS
- [ ] Verify token from env (not hardcoded)
- [ ] WhatsApp Flows (AES-GCM/RSA) — N/A if not implemented

### 2H — RAZORPAY
- [ ] Order amount fetched from server (Sheets/DB), not from client request
- [ ] Payment verification runs HMAC check before fulfillment
- [ ] Idempotency: duplicate TRX_ID checked before processing
- [ ] No client-supplied amount accepted

### 2I — API SECURITY HYGIENE
- [ ] CORS fail-closed (blocks all if `ALLOWED_ORIGINS` empty)
- [ ] Helmet.js with CSP configured
- [ ] `bodyParser.json({ limit: '10mb' })` set
- [ ] Custom NoSQL injection middleware active
- [ ] Joi validation on form endpoints

### 2J — DOCKER & DEPLOYMENT
- [ ] `ENV NODE_ENV=production` in Dockerfile
- [ ] `npm ci --omit=dev` used
- [ ] Dashboard build uses `NODE_ENV=development` override for vite install
- [ ] Non-root user in container
- [ ] `.dockerignore` excludes secrets, `.git`, `node_modules`
- [ ] `npm ci --dry-run` passes (lock file in sync)

### 2K — GOOGLE SHEETS
- [ ] No `fs.existsSync` service-account.json fallback
- [ ] Scope is `spreadsheets` only (no `drive.file`)
- [ ] `ENCRYPTED_STORED` placeholder in Aadhaar Image column
- [ ] Sheets errors caught and don't crash webhook handler

### 2L — MOBILE APP
- [ ] JWT in `SecureStore` (not AsyncStorage)
- [ ] API URL from `expo-constants` (not hardcoded)
- [ ] Logout uses `SecureStore.deleteItemAsync`
- [ ] expo-secure-store `~15.0.8` (SDK 54 aligned)
- [ ] `expo doctor` passes all 18 checks

### 2M — GEMINI AI (NEW — StayFlow Specific)
- [ ] `geminiRateLimitedUntil` variable exists in `src/bot.js`
- [ ] 429/quota errors handled gracefully (no error spam)
- [ ] 60-second cooldown on rate limit hit
- [ ] Both `validateInputWithAI()` and `handleGeminiChat()` check cooldown
- [ ] Fallback menu sent to user during cooldown

---

## QUICK VERIFICATION COMMANDS

Run these to spot-check all critical areas:

```bash
# 1. Git secrets check
git ls-files .env service-account.json
git log --all --full-history --oneline -- .env service-account.json

# 2. Credential quality
node -e "require('dotenv').config(); const k=process.env.ENCRYPTION_KEY; const j=process.env.JWT_SECRET; const a=process.env.ADMIN_PASSWORD; console.log('ENC_BYTES:'+Buffer.from(k,'hex').length+' JWT_LEN:'+j.length+' ADMIN_LEN:'+a.length)"

# 3. Strict schema count (should be 8)
grep -c "strict: true" src/db.js

# 4. Webhook order (sig line should be < log line)
grep -n "signature verified\|RAZORPAY_WEBHOOK" src/index.js

# 5. Aadhaar encryption checks
grep -n "ALLOWED_AADHAAR_MIMES\|encrypt(imageBuffer\|ENCRYPTED_STORED" src/bot.js src/sheets.js

# 6. Config no fallbacks
grep -n "jwtSecret\|adminPassword\|encryptionKey\|groq\|INSECURE" src/config.js

# 7. Docker checks
grep -n "NODE_ENV\|npm ci\|USER stayflow" Dockerfile

# 8. Mobile SecureStore
grep -n "SecureStore\|API_BASE_URL" mobile/src/api/api.js

# 9. Lock file valid
npm ci --omit=dev --dry-run

# 10. Rate limiter env-aware
grep -n "NODE_ENV.*production.*5\|authLimiter" src/index.js

# 11. Gemini rate limit
grep -n "geminiRateLimitedUntil\|429.*quota" src/bot.js
```

---

## SCORING RUBRIC

| Domain | Weight | Pass Criteria |
|--------|--------|---------------|
| Secrets & Credentials | HIGH | All git checks clean, no fallbacks, proper key lengths |
| Auth & Authorization | HIGH | JWT enforced, rate limit env-aware, all routes protected |
| Webhook Security | CRITICAL | Signature verified FIRST on both webhooks |
| Database Security | HIGH | Sanitizer active, all schemas strict, indexes present |
| File Handling | HIGH | MIME whitelist + AES-256-GCM + auth-gated endpoints |
| Error Handling | MEDIUM | No stack traces, generic messages only |
| Razorpay | HIGH | Server-amount, HMAC, idempotency |
| API Hygiene | MEDIUM | Helmet, CORS fail-closed, body limits |
| Docker/Deployment | MEDIUM | NODE_ENV, non-root, lock file sync |
| Google Sheets | MEDIUM | Env-only, minimal scope, no URL leak |
| Mobile App | MEDIUM | SecureStore, SDK-aligned, configurable URL |
| Gemini AI | LOW | Graceful rate limit, no error spam |

**Score each domain 1-10. Overall must be ≥ 9.0 for production clearance.**

---

## KNOWN ARCHITECTURE DECISIONS

These are intentional and should NOT be flagged:

1. **`req.query.token` for media downloads** — intentional auth bypass for file downloads opened in new browser tabs. Token is still verified via `verifyToken()`.

2. **`express-mongo-sanitize` replaced** — the npm package is incompatible with Express 5 (`req.query` is a read-only getter). Custom equivalent implemented inline.

3. **`NODE_ENV=development` for dashboard build** — intentional override so vite (devDependency) gets installed during Docker build. Container still runs as production.

4. **`AsyncStorage` for `appLanguage` and `userTheme`** — intentional. These are non-sensitive UI preferences, not credentials.

5. **Auth rate limit 100/hr in dev** — intentional. Strict 5/hr only in production (`NODE_ENV=production`).

6. **`ADMIN_PASSWORD=admin` in local `.env`** — intentional for local development. Production Render env should use a strong password.

7. **Gemini `{ isValid: true }` on error** — intentional fail-open for input validation. Blocks legitimate users if we fail-closed on AI errors.

---

## PRODUCTION DEPLOYMENT CHECKLIST

Before deploying to Render/production, verify ALL:

- [ ] `ADMIN_PASSWORD` set to strong value in Render (not `admin`)
- [ ] All credentials rotated (MongoDB, WhatsApp, Razorpay, Google SA, Cloudinary, Gemini)
- [ ] `ALLOWED_ORIGINS` set to actual production domains
- [ ] `NODE_ENV=production` set in Render environment
- [ ] `ENCRYPTION_KEY` is 64 hex chars in Render
- [ ] `JWT_SECRET` is 88+ chars in Render
- [ ] `RAZORPAY_WEBHOOK_SECRET` is production secret (not `test_webhook_secret`)
- [ ] WhatsApp token is permanent (not temporary/test)

---

## CURRENT STATUS (Round 6)

**Score: 10/10 | Status: ✅ CLEARED FOR PRODUCTION**

All security issues resolved. One manual action before go-live:
→ Update credentials in Render dashboard and redeploy.

**Last audit date:** 2026-06-06
**Last APK build:** v1.2.0 — `178129a7-e5fd-4059-a032-8d9f099988d8`
**GitHub:** https://github.com/tmisgowthaamand/StayFlow
**Backend:** https://stayflow-tkto.onrender.com
**Dashboard:** https://stay-flow-kohl.vercel.app
