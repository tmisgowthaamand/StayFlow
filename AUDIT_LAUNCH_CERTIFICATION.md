# Production Launch Certification Audit: StayFlow PG Automation

## 🚨 LAUNCH BLOCKED – P0 DETECTED IN THIS SECTION

### P0 - Critical Security & Reliability Issues

1. **Unauthorized Admin Access**
   - **Path:** `src/bot.js` (Lines 647-668)
   - **Finding:** Administrative commands such as `TOTAL TENANTS`, `PAID LIST`, `PENDING LIST`, `SEND BILL`, and `DASHBOARD` are implemented in the main message handler (`handleIncomingMessage`) without ANY check for the sender's phone number.
   - **Impact:** Any user (tenant or random person) can trigger bulk billing, view full lists of residents with their phone numbers/rooms, and view financial dashboard stats. This is a massive privacy breach and a denial-of-service vector.

2. **State Machine Lockout (User Blocking)**
   - **Path:** `src/bot.js` (Lines 533-537)
   - **Finding:** If a user is in a state (e.g., they started "JOIN" or "CASH PAID"), every future message they send is routed to `handleOnboarding`. There is no global "reset" command (except manually typing "CANCEL" if that step supports it), and no timeout for states.
   - **Impact:** If a user makes a mistake or stops halfway, they are permanently locked out of all other bot features (like typing "RENT" or "HI") until the server restarts or they accidentally hit a cancel keyword.

3. **Critical Reliability: Bulk Send Crash Loop**
   - **Path:** `src/cron.js` (Lines 12-32, 45-59, 72-86) and `src/bot.js` (Lines 1629-1632)
   - **Finding:** Bulk message operations (Monthly Billing, Reminders) iterate through all tenants and `await` the `sendMessage` call without a `try-catch` INSIDE the loop. 
   - **Impact:** If a single network error occurs or a single phone number is invalid during a batch of 100 residents, the entire cron job/process crashes. Remaining residents will not receive their bills or reminders.

4. **Information Disclosure (PII Leak via Static Files)**
   - **Path:** `src/index.js` (Line 55) and `src/pdfService.js` (Lines 337, 458)
   - **Finding:** The `uploads` directory is served as a public static directory. Invoices and registration forms are saved with predictable names: `invoice_{Phone}_{Timestamp}.pdf`.
   - **Impact:** An attacker can guess or brute-force filenames to download sensitive tenant documents containing Full Names, Phone Numbers, Room details, and potentially Aadhar data if linked.

5. **Unprotected Admin API Endpoints**
   - **Path:** `src/index.js` (Lines 643-692)
   - **Finding:** Endpoints like `/api/bulk-update-eb` and `/api/update-eb` lack any authentication (JWT, API Key, or session).
   - **Impact:** Anyone with the URL can programmatically alter resident bills and financial data in the Google Sheet.

6. **Concurrency Race Condition (Data Integrity)**
   - **Path:** `src/sheets.js` (Lines 278-294, 340-347, 511-515)
   - **Finding:** Data updates use `getRows()` followed by `row.save()`. 
   - **Impact:** There is no locking mechanism. If two admin operations occur simultaneously, or an automated sync runs during a manual update, one will overwrite the other, leading to corrupted financial records or lost payment confirmations.

---

### P1 - High Risk / Functional Deficiencies

1. **Hardcoded Production URLs**
   - **Path:** `src/bot.js` (Lines 42, 50)
   - **Finding:** Production URLs (`https://stay-flow-kohl.vercel.app`, `https://stayflow-hnm3.onrender.com`) are hardcoded in the logic instead of being loaded from `config.js`.
   - **Impact:** Moving environments or updating domains requires code changes and increases the risk of broken links in production.

2. **Sensitive Data in Production Logs**
   - **Path:** `src/sheets.js` (Lines 80-82)
   - **Finding:** The system logs the start and end character sequences of the Google Private Key.
   - **Impact:** Increases the risk of credential theft if log files are compromised.

3. **Collision Risk in Transaction IDs**
   - **Path:** `src/bot.js` (Line 1845)
   - **Finding:** Cash transaction IDs are generated using `Date.now().toString().slice(-6)`.
   - **Impact:** High probability of ID collision if multiple users submit payments within the same second, leading to record overwriting.

4. **Lack of Rate Limiting**
   - **Path:** `src/index.js` (Line 332)
   - **Finding:** The payment verification endpoint hits Google Sheets and Razorpay without rate limiting.
   - **Impact:** Vulnerable to brute-force ID guessing and resource exhaustion.

5. **Financial Precision Risk**
   - **Path:** `src/cron.js` (Lines 19, 48, 75)
   - **Finding:** Uses `parseFloat` for currency calculations.
   - **Impact:** Potential for floating-point precision errors in bill totals (e.g., ₹0.0000001 discrepancy), which is unprofessional for financial apps.

---

### P2 - Medium/Low Risk / Code Quality

1. **Local Persistent Storage Dependency**
   - **Path:** `src/pdfService.js` (Lines 338, 459)
   - **Finding:** PDFs are stored on the local disk.
   - **Impact:** On ephemeral environments like Render (seen in `render.yaml`), these files will be wiped on restart, causing 404s for users trying to download their bills later.

2. **Meta Template Dependency**
   - **Path:** `src/bot.js` (Line 162)
   - **Finding:** Fallback uses the `hello_world` template.
   - **Impact:** If the Meta account is restricted or the template is unapproved, fallback notifications will fail.

3. **MIME Type Guessing Fallback**
   - **Path:** `src/bot.js` (Line 459)
   - **Finding:** Defaults unknown files to `image/jpeg`.

---

**AUDIT SUMMARY:**
The system is currently **NOT SUITABLE FOR PRODUCTION**. The lack of authorization on bot commands and API endpoints represents a major security liability. The reliability of bulk automation is compromised by poor error handling in loops.

🚨 LAUNCH BLOCKED – P0 DETECTED IN THIS SECTION

---

## SECTION 1 – External Security Surface

### 🌐 Web API Routes (src/index.js)

| Route | Method | Line | Middleware Chain | Auth Enforcement | Signature/HMAC | Severity | Finding |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/payment-info` | GET | 83 | `NONE` | **NONE** | NONE | **P2** | Returns PII (Name, Room) to anyone with a phone number. |
| `/api/create-order` | POST | 118 | `NONE` | **NONE** | NONE | **P1** | Acceptable for checkout, but lacks rate limiting. Validates amount against sheets before creating order. |
| `/api/verify-razorpay-payment` | POST | 172 | `NONE` | **AUTH via SIG**| **MANDATORY** | **PASS** | Mandatory HMAC check (Line 186) before processing. |
| `/webhook` | GET | 239 | `NONE` | **NONE** | `hub.verify_token`| **PASS** | standard WA Cloud API verification. |
| `/webhook` | POST | 255 | `NONE` | **NONE** | **MISSING** | **P1** | Does not verify `X-Hub-Signature` from WhatsApp. |
| `/webhook/razorpay` | POST | 299 | `NONE` | **NONE** | **CONDITIONAL** | **P1** | Verification skipped if `key_secret` is missing (Line 312). |
| `/api/verify-transaction` | POST | 362 | `NONE` | **NONE** | NONE | **P1** | Public search; allows brute-forcing TRX_IDs to fetch PII. |
| `/api/media/:id` | GET | 620 | `NONE` | **NONE** | NONE | **P1** | Media proxy allows anyone to fetch WhatsApp media via IDs. |
| `/api/update-eb` | POST | 662 | `authenticate` | **REQUIRED** | N/A | **PASS** | Protected by API Key. |
| `/api/bulk-update-eb` | POST | 673 | `authenticate` | **REQUIRED** | N/A | **PASS** | Protected by API Key. |
| `/api/upload-aadhaar` | POST | 726 | `authenticate`, `multer`| **REQUIRED** | N/A | **P0** | **CRITICAL:** Multer allows any file type (no MIME check). Allows remote file upload to server. |
| `/api/submit-query` | POST | 754 | `NONE` | **NONE** | NONE | **P2** | Public query submission. |
| `/api/web-register` | POST | 804 | `multer` | **NONE** | NONE | **P0** | **CRITICAL:** Unauthenticated registration with unchecked file upload. |
| `/webhook/google-form` | POST | 844 | `NONE` | **NONE** | NONE | **P1** | Relies on obscurity; no source IP or secret validation. |
| `/api/tenants` | GET | 881 | `authenticate` | **REQUIRED** | N/A | **PASS** | Protected by API Key. |
| `/api/add-tenant` | POST | 896 | `authenticate` | **REQUIRED** | N/A | **PASS** | Protected by API Key. |
| `/api/trigger-notifications` | POST | 952 | `authenticate` | **REQUIRED** | N/A | **PASS** | Protected by API Key. |
| `/api/generate-invoice` | POST | 1083 | `NONE` | **NONE** | NONE | **P2** | Public endpoint to trigger invoice PDF generation. |
| `/api/notify-tenant` | POST | 1107 | `NONE` | **NONE** | NONE | **P0** | **CRITICAL:** Allows anyone to trigger WhatsApp notification bills to any number. |
| `/api/update-bill` | POST | 1153 | `NONE` | **NONE** | NONE | **P0** | **CRITICAL:** Public endpoint to modify financial data (Rent/EB) in sheets. |
| `/api/update-and-notify` | POST | 1169 | `authenticate` | **REQUIRED** | N/A | **PASS** | Protected by API Key. |
| `/api/mark-paid` | POST | 1201 | `authenticate` | **REQUIRED** | N/A | **PASS** | Protected by API Key. |
| `/api/delete-tenant` | POST | 1251 | `authenticate` | **REQUIRED** | N/A | **PASS** | Protected by API Key. |
| `/api/sync-to-mongo` | POST | 1285 | `NONE` | **NONE** | NONE | **P1** | Anyone can trigger an expensive full-sheet sync. |
| `/api/archived-tenants` | GET | 1294 | `authenticate` | **REQUIRED** | N/A | **PASS** | Protected by API Key. |
| `/api/announcement` | POST | 1303 | `multer` | **NONE** | NONE | **P0** | **CRITICAL:** Anyone can broadcast files/messages to all PG residents. |
| `/api/notifications` | GET | 1371 | `authenticate` | **REQUIRED** | N/A | **PASS** | Protected by API Key. |
| `/api/notifications/mark-read` | POST | 1389 | `NONE` | **NONE** | NONE | **P2** | Public notification management. |
| `/api/notifications` | DELETE | 1403 | `NONE` | **NONE** | NONE | **P0** | **CRITICAL:** Anyone can delete all system notifications. |
| `/api/locations` | GET | 1412 | `NONE` | **NONE** | NONE | **P0** | **CRITICAL:** Publicly leaks PG branch details and addresses. |
| `/api/locations` | POST | 1417 | `NONE` | **NONE** | NONE | **P0** | **CRITICAL:** Anyone can create fake branches in the system. |
| `/api/eb-bills` | GET | 1425 | `NONE` | **NONE** | NONE | **P0** | **CRITICAL:** Publicly leaks historical EB bill totals. |
| `/api/eb-bills` | POST | 1432 | `authenticate` | **REQUIRED** | N/A | **PASS** | Protected by API Key. |
| `/api/dashboard-stats` | GET | 1452 | `authenticate` | **REQUIRED** | N/A | **PASS** | Protected by API Key. |
| `/api/config` | GET | 1460 | `NONE` | **NONE** | NONE | **P1** | Leaks business UPI ID, Owner Phone, and Due Dates. |

### 🤖 WhatsApp Command Surface (src/bot.js)

| Command Pattern | Handler Function | Line | Auth Check | Severity | Finding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TOTAL TENANTS` | `handleAdminTotal` | 682 | **MANDATORY** | **PASS** | Checked via `isAdmin` guard (Line 566). |
| `PAID LIST` | `handleAdminList` | 685 | **MANDATORY** | **PASS** | Checked via `isAdmin` guard (Line 566). |
| `PENDING LIST` | `handleAdminList` | 688 | **MANDATORY** | **PASS** | Checked via `isAdmin` guard (Line 566). |
| `DASHBOARD` | `handleDashboard` | 691 | **MANDATORY** | **PASS** | Checked via `isAdmin` guard (Line 566). |
| `SEND BILL` | `handleSendBillAll` | 694 | **MANDATORY** | **PASS** | Checked via `isAdmin` guard (Line 566). |
| `SEND REMINDER` | `handleSendReminder`| 697 | **MANDATORY** | **PASS** | Checked via `isAdmin` guard (Line 566). |
| `ANNOUNCE` | N/A | 700 | **MANDATORY** | **PASS** | Checked via `isAdmin` guard (Line 566). |

### 🛡️ Global Protective Controls

- **CORS Configuration:** `src/index.js (Line 29)` — Uses `config.allowedOrigins`. Vulnerable if environment variable is not set correctly (defaults to `*`).
- **Rate Limiting:** **NOT FOUND** in entire repository. Server is vulnerable to DoS and brute-force (Severity: **P1**).
- **File Upload Validation:** **MISSING** (Severity: **P0**). Routes using `multer` allow any file type and size.

### ✅ VALIDATION SUMMARY
**RESULTS:** Repo-wide grep verified all `app.get/post/use` calls against the list. 
**STATUS:** **P0 DETECTED.** Multiple high-impact administrative endpoints are exposed without authentication.

🚨 LAUNCH BLOCKED – P0 DETECTED IN THIS SECTION

---

## SECTION 2 – Idempotency Guarantees

### 💸 Payment Processing & Webhooks

| Mechanism | Path | Line | Idempotency Check | Severity | Finding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Razorpay Webhook** | `src/index.js` | 299 | `Log.create` | **P0** | MongoDB index exists on `details.id` but the webhook handler does not check it *before* calling `handleRazorpaySuccess`. |
| **Payment Success** | `src/bot.js` | 1753 | `Log.findOne` | **P0** | **RACE CONDITION:** `findOne` for `details.trxId` (Line 1770) happens before `Log.create` (Line 1806). Concurrent requests will both pass the check. |
| **Sheet Logging** | `src/sheets.js`| 232 | `getRows` / `some` | **P0** | **CRITICAL:** Read-Modify-Write pattern on Google Sheets is non-atomic. Two threads can bypass the `existsInHistory` check simultaneously. |
| **TRX Uniqueness** | `src/db.js` | 15 | **MONGO INDEX** | **P1** | Database level protection exists for Razorpay Event IDs, but NOT for Transaction IDs or Payment IDs in the `Tenant` or `Log` schemas beyond this sparse index. |
| **WhatsApp Dedupe** | `src/bot.js` | 521 | **NOT FOUND** | **P1** | Incoming `messageId` is stored in logs but not checked for uniqueness before processing. Replay attack possible. |

### 🛠️ Execution Trace: Duplicate Webhook Race (P0)

1. **T+0ms (Webhook A):** Receives `payment.captured` for `PAY_ID_1`.
2. **T+5ms (Webhook B):** Receives replayed `payment.captured` for `PAY_ID_1`.
3. **T+50ms (Proc A):** Calls `Log.findOne({ "details.trxId": "PAY_ID_1" })`. Result: **NULL**.
4. **T+55ms (Proc B):** Calls `Log.findOne({ "details.trxId": "PAY_ID_1" })`. Result: **NULL**.
5. **T+100ms (Proc A):** Passes idempotency check. Calls `sheetsService.logPayment`.
6. **T+105ms (Proc B):** Passes idempotency check. Calls `sheetsService.logPayment`.
7. **T+500ms (Proc A):** Google Sheets `addRow` (SUCCESS).
8. **T+505ms (Proc B):** Google Sheets `addRow` (**DOUBLE REVENUE RECORDED**).

**FINAL STATE:** "History" and "Payments" sheets contain two rows for the same payment. Financial reporting is corrupted.

### ✅ VALIDATION SUMMARY
**RESULTS:** **P0 DETECTED.** The system relies on app-level checks without atomic locking or database-level uniqueness for Transaction IDs.

🚨 LAUNCH BLOCKED – P0 DETECTED IN THIS SECTION

---

## SECTION 3 – State Machine Integrity

### 🧠 Persistence & Transitions (src/bot.js)

| Feature | Implementation | Line | State | Severity | Finding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **State Persistence** | `Session` MongoDB | 35 | **VALID** | **PASS** | State survives server restarts and processes via MongoDB persistence. |
| **Transition Logic** | `switch (state.step)` | 1850 | **AD-HOC** | **P1** | No central state machine or validator. Transitions are scattered across `handleOnboarding`. |
| **State Mutation** | `updateSession` | 40 | **RACY**| **P0** | **CRITICAL:** No locking between `getSession` (Line 547) and the subsequent work inside `handleOnboarding`. Parallel user messages will cause lost updates. |
| **Session Sprawl** | `updatedAt` TTL | 56 (db.js) | **VALID** | **PASS** | 1-hour session expiry prevents database bloat. |

### 🚨 State Corruption Simulation (P0)

1. **User Sends Msg 1:** "I want to pay cash".
2. **HandleMsg 1:** Calls `getSession`. State: `{ step: 'PAYMENT_METHOD' }`.
3. **User Sends Msg 2 (Parallel):** "Wait, cancel" (or any other input).
4. **HandleMsg 2:** Calls `getSession`. State: `{ step: 'PAYMENT_METHOD' }` (Msg 1 update not saved yet).
5. **HandleMsg 1:** Sets `state.step = 'CASH_AMOUNT'`. Calls `updateSession`.
6. **HandleMsg 2:** Sets `state.step = 'IDLE'`. Calls `updateSession`.
7. **RESULT:** HandleMsg 1 continues execution thinking it's in `CASH_AMOUNT`, but the DB says `IDLE`. Next message from user will trigger main menu instead of amount collection.

### ✅ VALIDATION SUMMARY
**RESULTS:** **P0 DETECTED.** Non-atomic state mutation with database persistence creates race conditions for fast-replying users.

🚨 LAUNCH BLOCKED – P0 DETECTED IN THIS SECTION

---

## SECTION 4 – Financial Invariants

### 💳 Payment Lifecycle & Reconciliation

| Path | Check | Line | Result | Severity | Finding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `src/bot.js` | Amount Reconciliation | 1777 | **SUCCESS** | **PASS** | `Math.abs(amount - expectedTotal) > 1` blocks "Pay ₹1" exploit. |
| `src/index.js`| Razorpay HMAC | 186 | **MANDATORY**| **PASS** | Checkout verification requires valid signature. |
| `src/index.js`| Webhook HMAC | 324 | **CONDITIONAL**| **P1** | Verification skipped if `key_secret` is missing. |
| `src/bot.js` | Cash Amount Guard | 1894 | **MISSING** | **P0** | **CRITICAL:** Bot accepts any numeric input for cash payments without validating against debt. |
| `src/index.js`| Add Tenant Advance| 818 | **MISSING** | **P2** | Manual entry of advance payment is not double-verified. |

### 🛠️ Exploit Trace: Cash Payment Under-Billing (P0)

1. **Bot:** "Rent is ₹7500. How much did you pay?"
2. **User:** "1"
3. **Bot:** "Step 2: Date of Payment..."
4. **Sheet Update:** `updateTenant` saves "Advance: 1" and Status: "PENDING".
5. **Impact:** System records a near-zero payment attempt as a legitimate "Pending" history entry. High risk of human error/fraud during manual reconciliation.

---

## SECTION 5 – Database Safeguards

### 🗄️ Persistence Layer Integrity

| Storage | Guard | Path | Status | Severity | Finding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MongoDB** | Unique TRX_ID | `src/db.js` | **MISSING** | **P0** | No unique index on Transaction IDs in any collection. |
| **MongoDB** | Unique Phone | `src/db.js` | **VALID** | **PASS** | `phone: { type: String, unique: true }` in `Tenant` and `Session`. |
| **MongoDB** | Enum Validation | `src/db.js` | **MISSING** | **P1** | `Status` is a raw `String`. Risk of invalid state injection. |
| **Sheets** | Phone Dedupe | `src/sheets.js` | **WEAK** | **P1** | `addTenant` does a racy check before appending. |
| **Sheets** | History Uniqueness | `src/sheets.js` | **WEAK** | **P1** | `logPayment` does a racy `some()` check on `TRX_ID`. |

### ✅ VALIDATION SUMMARY
**RESULTS:** **P0 DETECTED.** MongoDB provides zero protection against duplicate Transaction IDs if the app logic fails or racing occurs.

---

## SECTION 6 – Observability

### 🔍 Request Tracing & Dispute Resolution

| Feature | Presence | Path | Severity | Finding |
| :--- | :--- | :--- | :--- | :--- |
| **Correlation ID** | **NOT FOUND** | N/A | **P1** | Impossible to link log lines across `index.js`, `bot.js`, and `sheets.js` under load. |
| **Message ID Store**| **YES** | `src/bot.js:521` | **PASS** | Captured in console logs but not searchable in DB. |
| **TRX_ID Search** | **PARTIAL** | `src/db.js` | **P2** | Indicated in `Log` data but not first-class field. |
| **Lifecycle Trace** | **FAIL** | N/A | **P1** | Cannot reconstruct full payment story (Incoming -> Webhook -> Sheet -> PDF) from MongoDB alone. |

### ✅ VALIDATION SUMMARY
**RESULTS:** **P1 DETECTED.** Lack of structured correlation IDs makes debugging multi-user races extremely time-consuming.

---

## SECTION 7 – Concurrency & Race Conditions

### 🏎️ Atomic Operations

| Operation | Guard | Path | Result | Severity | Finding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tenant Update** | **NONE** | `src/sheets.js` | **VULNERABLE** | **P0** | Read-Modify-Write in `updateTenant` is non-atomic. |
| **Payment Log** | **NONE** | `src/sheets.js` | **VULNERABLE** | **P0** | Parallel `logPayment` calls cause duplicate history rows. |
| **Session Update** | **NONE** | `src/bot.js` | **VULNERABLE** | **P0** | No locking on MongoDB `Session` document updates. |
| **Bulk EB Update** | **NONE** | `src/index.js` | **VULNERABLE** | **P1** | Iterative update loop; partial failure leaves inconsistent state. |

### ✅ VALIDATION SUMMARY
**RESULTS:** **P0 DETECTED.** The system assumes sequential execution; parallel traffic WILL corrupt Google Sheets data.

---

## SECTION 8 – Operational Readiness

### ⚙️ Startup & Health Guards

| Check | Presence | Line | Status | Severity | Finding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **API Health** | **YES** | 1472 | **PASS** | **PASS** | Validates both MongoDB and Sheets connectivity correctly. |
| **Env Validation** | **YES** | 72 | **PASS** | **PASS** | `process.exit(1)` on missing critical keys. |
| **Cron Overlap** | **NO** | `src/cron.js` | **MISSING** | **P1** | No guard against overlapping daily/monthly jobs. |
| **Backup Script** | **NO** | N/A | **MISSING** | **P0** | **CRITICAL:** No automated backup strategy for Google Sheets data found. |

### ✅ VALIDATION SUMMARY
**RESULTS:** **P0 DETECTED.** No automated backup strategy for the primary database (Google Sheets).

---

## RE-AUDIT 2026-02-14 (15:00) - FINAL SUMMARY

### 🚨 LAUNCH BLOCKED – P0 DETECTED

The following critical security [P0] vulnerabilities must be resolved before production deployment:
1. **Unauthenticated Admin Endpoints**: 5 critical endpoints exposed (Locations, EB Bills, Notify Tenant, etc.).
2. **Arbtirary Cash Payment**: Bot accepts ₹1 for any bill due to missing server-side validation.
3. **Concurrency Corruption**: No locking on Google Sheets writes; duplicate financial logs possible under load.
4. **Data Loss Risk**: No automated backup for Google Sheets source of truth.

---
**AUDIT VERDICT:** **NON-COMPLIANT**. System security and data integrity do not meet minimum production standards.
