# 📱 StayFlow — WhatsApp User Flow
> Complete end-to-end flow for every tenant interaction on WhatsApp.
> Last updated: June 2026

---

## 📌 Table of Contents
1. [Message Routing Engine](#1-message-routing-engine)
2. [First Contact — HI / HELLO](#2-first-contact--hi--hello)
3. [New Registration Flow](#3-new-registration-flow)
4. [VACATED User Flow](#4-vacated-user-flow)
5. [Main Menu (List)](#5-main-menu-list)
6. [Rent & Bill Flow](#6-rent--bill-flow)
7. [Payment — Razorpay (Online)](#7-payment--razorpay-online)
8. [Payment — Cash](#8-payment--cash)
9. [EB Bill Flow](#9-eb-bill-flow)
10. [Statements Flow](#10-statements-flow)
11. [Vacancy Rooms Flow](#11-vacancy-rooms-flow)
12. [Vacate Room Flow](#12-vacate-room-flow)
13. [Help / Queries Flow](#13-help--queries-flow)
14. [History & Receipt Flow](#14-history--receipt-flow)
15. [Refer a Friend Flow](#15-refer-a-friend-flow)
16. [Holiday List & Rules](#16-holiday-list--rules)
17. [Gemini AI Fallback](#17-gemini-ai-fallback)
18. [Automated Cron Messages](#18-automated-cron-messages)
19. [Session & Escape Mechanism](#19-session--escape-mechanism)
20. [Status Values Reference](#20-status-values-reference)

---

## 1. Message Routing Engine

Every incoming WhatsApp message passes through this pipeline before hitting any feature flow.

```
Tenant sends any message
         │
         ▼
┌─────────────────────────────────┐
│  Per-user concurrency lock      │
│  (drops duplicate parallel msg) │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Active session exists?         │  ──YES──► handleOnboarding()
│  (multi-step flow in progress)  │           (continue the flow)
└────────────┬────────────────────┘
             │ NO
             │  But if message is an escape keyword:
             │  HI / HELLO / CANCEL / STOP / RENT / STATUS / PAID
             │  → session is CLEARED → continue below
             ▼
┌─────────────────────────────────┐
│  Is it an admin command?        │  ──YES──► Check if from owner phone
│  (TOTAL TENANTS / PAID LIST...) │           else → "Unauthorized" ❌
└────────────┬────────────────────┘
             │ NO
             ▼
┌─────────────────────────────────┐
│  handleSmartPayment()           │  ──YES──► Payment shortcut routes
│  (PAID / CASH / TXN ID text)    │
└────────────┬────────────────────┘
             │ NO
             ▼
┌─────────────────────────────────┐
│  switch(cleanBody)              │
│  HI / RENT / PAID / HELP ...    │  ──────► Feature handlers
└────────────┬────────────────────┘
             │ no match
             ▼
┌─────────────────────────────────┐
│  handleSmartChat()              │
│  Keyword matching → Gemini AI   │
└─────────────────────────────────┘
```

---

## 2. First Contact — HI / HELLO

**Trigger words:** `HI` `HII` `HIE` `HELO` `HELLO` `HOLA` `HAI` `HEY` `NAMASTE`

```
Tenant types: HI
         │
         ▼
┌────────────────────────────────────────┐
│  Look up phone in Google Sheets        │
└──────────┬──────────┬──────────────────┘
           │          │
      NOT FOUND    FOUND: Status=VACATED
           │          │
           │          ▼
           │   ┌──────────────────────────────────┐
           │   │ "Your tenancy has ended.         │
           │   │  Contact admin for re-admission." │
           │   │  + Admin WhatsApp link            │
           │   │  FLOW STOPS HERE                  │
           │   └──────────────────────────────────┘
           │
           ▼
    FOUND: Active tenant?
    ┌────────────┴────────────────┐
    │ YES (PAID/PENDING/ACTIVE)   │  NO (new user)
    ▼                             ▼
┌──────────────────────┐   ┌─────────────────────────┐
│ Personalised banner  │   │ Generic welcome banner   │
│ Name, Room, Status   │   │ "Welcome to StayFlow"    │
│ Rent + EB + Total    │   │                          │
└──────────┬───────────┘   └────────────┬────────────┘
           │                            │
           └──────────┬─────────────────┘
                      ▼
           ┌──────────────────────────────────────────────┐
           │  INTERACTIVE LIST MENU (sendListMessage)      │
           │                                              │
           │  SERVICES section:                           │
           │  ┌─ 🚪 Vacate (if registered)               │
           │  ├─ 📝 New Register (if not registered)      │
           │  ├─ 🏠 Rent                                  │
           │  ├─ 💳 Pay Bills                             │
           │  ├─ ⚡ EB Bill                               │
           │  ├─ 📜 Statements                            │
           │  └─ ❓ Queries                               │
           │                                              │
           │  INFORMATION section:                        │
           │  ├─ 🎉 Holiday List                          │
           │  ├─ 📋 Rules                                 │
           │  ├─ 🛏️ Vacancy Rooms                        │
           │  └─ 👥 Refer a Friend                        │
           └──────────────────────────────────────────────┘
```

---

## 3. New Registration Flow

**Trigger:** Tap "New Register" from menu  OR  type `JOIN`

### Channel A — WhatsApp Bot Multi-Step

```
Tenant taps "New Register" or types JOIN
         │
         ▼
Bot sends: Registration form URL + JOIN banner image
         │
         ▼  (Tenant fills Google Form or Web Form)
         │
         ▼  [OR Admin registers via dashboard → same pipeline]
         │
┌────────────────────────────────────────────────────┐
│  Bot multi-step onboarding (handleOnboarding)      │
│                                                    │
│  Step 1 ─ NAME                                     │
│    Ask: "Enter your full name"                     │
│    Gemini AI validates: not gibberish/numbers      │
│    ❌ fail → "Please enter a valid name"            │
│    ✅ pass → save, go to step 2                    │
│                                                    │
│  Step 2 ─ PHONE_NUMBER                             │
│    Ask: "Confirm your phone number"                │
│    Gemini AI validates: 10–12 digits               │
│                                                    │
│  Step 3 ─ ROOM                                     │
│    Ask: "Room number"                              │
│    Gemini AI validates: valid room format          │
│                                                    │
│  Step 4 ─ SHARING_TYPE                             │
│    Ask: "Choose sharing type:                      │
│           1. One  (₹9000)                          │
│           2. Two  (₹7000)                          │
│           3. Three(₹6500)                          │
│           4. Four (₹6500)"                         │
│    Invalid choice → re-prompt                      │
│                                                    │
│  Step 5 ─ ADVANCE                                  │
│    Ask: "Advance paid amount"                      │
│                                                    │
│  Step 6 ─ AADHAAR_UPLOAD                           │
│    Ask: "Please upload Aadhaar image"              │
│    No image → "Please upload an image"             │
│    Image received →                               │
│      • AES-GCM encrypt image                      │
│      • Upload encrypted file to Cloudinary        │
│      • Store metadata in MongoDB                  │
└────────────────────┬───────────────────────────────┘
                     │ All steps complete
                     ▼
         ┌──────────────────────────────────┐
         │  sheetsService.addTenant()       │
         │  • Duplicate phone check         │
         │  • Add row to Tenants sheet      │
         │  • Auto-sync to MongoDB          │
         │  • Update Location occupancy     │
         └────────────┬─────────────────────┘
                      │
                      ▼
         ┌──────────────────────────────────┐
         │  Generate Registration PDF        │
         │  Upload to Cloudinary            │
         └────────────┬─────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
   Tenant receives:          Admin receives:
   • Welcome message         • "New Registration"
   • PG Rules (full)         • Registration PDF
   • Registration PDF        • Push notification
   • "Type HI for dashboard" • Dashboard notification
```

---

## 4. VACATED User Flow

**Who:** Any tenant whose `Status = VACATED` in Google Sheets.

```
VACATED user types any message (HI, PAID, RENT, etc.)
         │
         ▼
Bot checks Status → VACATED
         │
         ▼
┌──────────────────────────────────────────────────┐
│  "👋 Hi [Name],                                  │
│                                                  │
│   Your tenancy with StayFlow has ended and       │
│   your account is marked as VACATED.             │
│                                                  │
│   For re-joining or concerns, contact admin:     │
│   📞 https://wa.me/[adminPhone]                  │
│                                                  │
│   Do NOT reply to re-register —                  │
│   contact admin for re-admission."               │
└──────────────────────────────────────────────────┘
         │
         ▼
    FLOW STOPS — no menu, no options shown

⚠️  Re-admission path:
    Tenant → Contacts Admin → Admin adds via Dashboard
    → New row in Sheets with ACTIVE status
    → Tenant can use bot again
```

---

## 5. Main Menu (List)

After any service action completes, bot sends `sendMainMenuList()` so tenant never has to type HI again.

```
┌──────────────────────────────────────────────────────┐
│  StayFlow Interactive List                           │
│  ┌────────────────────────────────────────────────┐  │
│  │ SERVICES                                       │  │
│  │  🚪 Vacate        — Request to vacate room     │  │
│  │  🏠 Rent          — View rent details & bill   │  │
│  │  💳 Pay Bills     — Pay via Razorpay or Cash   │  │
│  │  ⚡ EB Bill       — View electricity bill      │  │
│  │  📜 Statements    — Monthly payment statements │  │
│  │  ❓ Queries       — Submit query or complaint  │  │
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │ INFORMATION                                    │  │
│  │  🎉 Holiday List  — Upcoming holidays          │  │
│  │  📋 Rules         — PG house rules             │  │
│  │  🛏️ Vacancy Rooms — Check available rooms     │  │
│  │  👥 Refer a Friend— Invite & earn rewards      │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘

Each row selection → routes to that feature's handler
```

---

## 6. Rent & Bill Flow

**Trigger:** `RENT` command  OR  tap "🏠 Rent" from menu

```
Tenant types RENT or taps Rent from menu
         │
         ▼
┌──────────────────────────────────────┐
│  Fetch tenant from Sheets/MongoDB    │
│  Not found → "Please JOIN first"     │
└────────────┬─────────────────────────┘
             │ found
             ▼
┌──────────────────────────────────────┐
│  Read: Name, Room, Rent, EB, Total   │
│  Build invoice PDF                   │
│  (StayFlow_Invoice.pdf)              │
│  Generate Razorpay payment link      │
└────────────┬─────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
  Status=PAID    Status≠PAID
  or VALID       (PENDING/ACTIVE)
      │             │
      ▼             ▼
 Send PDF +    Send PDF with
 "VALID"       3 buttons:
 caption       ┌───────────────────┐
               │ 💳 Pay Now UPI    │
               │ 💵 Pay Cash       │
               │ ❌ Cancel         │
               └───────────────────┘
               session → PAYMENT_METHOD
               Also sends: Contact Us CTA

             │
             ▼
        → See Payment flows (§7 & §8)
```

---

## 7. Payment — Razorpay (Online)

**Trigger:** Tap "💳 Pay via Razorpay" OR "💳 Pay Now UPI" button

```
Tenant taps "💳 Pay via Razorpay"
         │
         ▼
Bot fetches amount from Sheets (fraud-safe: never user-provided)
         │
         ▼
┌──────────────────────────────────────────────────┐
│  sendCTAButton:                                  │
│  "💳 Secure Payment"                             │
│  Body: Rent ₹X | EB ₹Y | Total ₹Z               │
│  Button: [💳 Pay Now]                            │
│  URL: https://stay-flow-kohl.vercel.app/         │
│       payment.html?phone=91xx&name=Ravi          │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
         Tenant opens payment.html in browser
                     │
                     ▼
         ┌────────────────────────────────────┐
         │  Payment page fetches:             │
         │  GET /api/payment-info?phone=91xx  │
         │  (Cache → MongoDB → Sheets)        │
         │  Returns: rent, eb, total, status  │
         └──────────────┬─────────────────────┘
                        │
                        ▼
         POST /api/create-order
         → Razorpay creates Order (amount locked from Sheets)
         → Returns orderId, amount, razorpayKeyId
                        │
                        ▼
         Tenant pays via UPI/Card on Razorpay
                        │
              ┌─────────┴─────────┐
              │                   │
         Webhook fires       Redirect fires
         (instant)          (confirmation.html)
              │                   │
              └────────┬──────────┘
                       ▼
         POST /api/verify-razorpay-payment
         HMAC SHA256 signature verified
                       │
              ┌────────┴────────┐
              │                 │
         Amount OK         Amount mismatch
              │                 │
              ▼                 ▼
    handleRazorpaySuccess()  🚨 FRAUD ALERT
    • Status = PAID           → status stays PENDING
    • Log to MongoDB          → admin notified
    • Generate Invoice PDF    → tenant notified
    • Send to tenant          → FLOW ENDS
    • Notify admin
    • Push notification
              │
              ▼
   Tenant WhatsApp receives:
   ✅ "Payment Successful!"
   + Invoice PDF attached
   + Admin receives: "Payment Verified" summary
```

---

## 8. Payment — Cash

**Trigger:** Tap "💵 Pay Cash" OR type `CASH PAID`

```
Tenant taps "💵 Pay Cash"
         │
         ▼
Check status → VACATED? → "Tenancy ended" message. STOP.
         │ not vacated
         ▼
┌──────────────────────────────────────────┐
│  Show bill summary                       │
│  🏠 Rent ₹X | ⚡ EB ₹Y | 💰 Total ₹Z   │
│  "Enter the exact amount paid."          │
│  session → CASH_AMOUNT                   │
└────────────────┬─────────────────────────┘
                 │
         Tenant types amount (e.g. 6500)
                 │
                 ▼
         Validate amount:
         ┌───────┴──────────┐
         │                  │
     Underpayment        Amount OK
     detected            │
         │               ▼
         ▼         session → CASH_DATE
    "❌ Underpay    "Enter the date you paid cash"
     not allowed"
                         │
                 Tenant types date (e.g. Today / 12/06/2026)
                         │
                         ▼
         ┌──────────────────────────────────────┐
         │  Create Payment record in MongoDB    │
         │  mode=CASH, status=PENDING           │
         │  trxId = CASH-xxxxxx                 │
         │  Update Sheets: Status=PENDING       │
         │  Log to Payments sheet               │
         └────────────┬─────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
   Tenant receives:          Admin receives:
   ⏳ "Cash Payment           💵 "Cash Payment —
    Submitted"                 Needs Verification"
   + Ref ID                  + Tenant name, room
   + "Invoice after          + Amount, Ref ID
    admin confirm"           + Reply: VERIFY CASH 91xx

                             ⏰ 24h TIMEOUT CRON:
                             If admin hasn't acted after 24h:
                             → Admin gets another reminder
                             → Tenant gets "still processing" msg
                             → cashReminderSent = true (no repeat)
                      │
           Admin replies: VERIFY CASH 91xx
                      │
                      ▼
         handleVerifyPayment()
         • Status = PAID
         • Generate Invoice PDF
         • Send to tenant ✅
         • Confirm to admin

           OR admin replies: REJECT 91xx
                      │
                      ▼
         handleRejectPayment()
         • Status = INVALID
         • Tenant notified: "Payment rejected, retry"
         • No invoice generated
```

---

## 9. EB Bill Flow

**Trigger:** `EB` command  OR  tap "⚡ EB Bill" from menu

```
Tenant types EB or taps EB Bill
         │
         ▼
Fetch tenant from Sheets
         │
         ▼
┌──────────────────────────────────────────┐
│  ⚡ Electricity Bill — [Month]           │
│  Name: Ravi | Room: 101                  │
│  EB Amount: ₹500                         │
│  Rate: ₹15/unit                          │
│  Rent: ₹6000                             │
│  ─────────────────────                   │
│  Total: ₹6500                            │
└────────────┬─────────────────────────────┘
             │
      Status = PAID?
      ┌──────┴──────┐
    YES            NO
      │              │
      ▼              ▼
   [📞 Contact]   3 buttons:
   button only    💳 Pay via Razorpay
                  💵 Pay Cash
                  ❌ Cancel
                  session → PAYMENT_METHOD

Admin can update EB via:
  WhatsApp: SET EB 101 150
  → splits units across all roommates
  → notifies each tenant with their share
  → sets status back to PENDING
```

---

## 10. Statements Flow

**Trigger:** Tap "📜 Statements" from menu  OR  type `HISTORY`

```
Tenant taps Statements
         │
         ▼
Fetch last 3 payments from Payments sheet
         │
         ▼
┌──────────────────────────────────────────┐
│  📜 Payment Statements                   │
│  ✅ June-2026 | ₹6500 | UPI | 05/06     │
│  ✅ May-2026  | ₹6000 | Cash| 04/05     │
│  ✅ Apr-2026  | ₹6500 | UPI | 03/04     │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│  INTERACTIVE LIST — Select Month         │
│  Last 10 months shown as rows            │
│  e.g. "June 2026", "May 2026" ...        │
└────────────┬─────────────────────────────┘
             │ Tenant selects a month
             ▼
    handleStatementMonth(year, month)
    → Search Payments sheet for that month
    → Found: Show Rent, EB, Total, Mode, TXN, Date
    → Not found: "No record found" + Contact button
```

---

## 11. Vacancy Rooms Flow

**Trigger:** Tap "🛏️ Vacancy Rooms" from menu

```
Tenant taps Vacancy Rooms
         │
         ▼
┌────────────────────────────────────────────────┐
│  Fetch from Sheets (with error isolation):     │
│  Promise.all([getAllTenants, getAllLocations])  │
└──────────────┬───────────────────────────────-─┘
               │
        Sheets reachable?
        ┌──────┴──────┐
       YES            NO (error/timeout/empty)
        │              │
        ▼              ▼
  Formula applied:  ┌──────────────────────────────┐
  availableBeds =   │  ⚠️ "Unable to load live     │
  totalBeds         │   availability right now."    │
  - count(tenants   │   "Contact admin directly."  │
    WHERE status    │   + Admin WhatsApp link       │
    != 'VACATED')   │   + Register Now CTA button   │
        │           └──────────────────────────────┘
        ▼
┌───────────────────────────────────────────────┐
│  🛏️ Available Rooms                          │
│                                               │
│  📍 Main Branch                               │
│     🛏️ Total Beds   : 40                     │
│     👤 Occupied     : 32                     │
│     🟢 Vacant       : 8                      │
│                                               │
│  📍 Branch 2 (if configured)                  │
│     🛏️ Total Beds   : 20                     │
│     👤 Occupied     : 20                     │
│     🔴 Vacant       : 0                      │
│                                               │
│  ✅ 8 bed(s) available across all locations   │
│  Fill form to apply ↓                         │
└────────────────────────────────────────────────┘
         │
         ▼
  [Register Now] CTA button
  → https://stay-flow-kohl.vercel.app/register.html

Admin override: Edit "Total Beds" column in Locations sheet
```

---

## 12. Vacate Room Flow

**Trigger:** Tap "🚪 Vacate" from menu  OR  type `VACATE` / `LEAVE`

```
Tenant taps Vacate
         │
         ▼
Fetch tenant → not found → "Not registered. Type HI."
         │ found
         ▼
┌──────────────────────────────────────────────────┐
│  STEP 1/3 — Reason                               │
│  Show: Name, Room, Rent, Advance                 │
│  Ask: "Please type your reason for leaving"      │
│  session → VACATE_STEP_REASON                    │
└────────────────┬─────────────────────────────────┘
                 │ Tenant types reason (min 3 chars)
                 │ Invalid → re-prompt
                 ▼
┌──────────────────────────────────────────────────┐
│  STEP 2/3 — Vacate Date                          │
│  Sends INTERACTIVE LIST of date options:         │
│   📅 30 days from today (minimum notice)         │
│   📅 End of next month                           │
│   📅 45 days from today                          │
│   📅 60 days from today                          │
│   📅 End of month after next                     │
│   📅 90 days from today                          │
│  session → VACATE_STEP_DATE                      │
└────────────────┬─────────────────────────────────┘
                 │ Tenant selects a date
                 ▼
┌──────────────────────────────────────────────────┐
│  STEP 3/3 — Feedback                             │
│  Ask: "Any feedback about your stay?"            │
│  Tenant types feedback OR "SKIP"                 │
│  session → VACATE_STEP_FEEDBACK                  │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│  CONFIRMATION BUTTONS                            │
│  Shows full summary:                             │
│  Name, Room, Reason, Date, Feedback              │
│  [✅ Confirm & Submit]  [❌ Cancel]              │
│  session → VACATE_STEP_CONFIRM                   │
└────────────────┬─────────────────────────────────┘
                 │ Tenant taps Confirm
                 ▼
         processVacateRequest()
         • Generate Vacate PDF (with Request ID)
         • Generate vacate submitted image card
         │
         ├──► Tenant receives:
         │    • Submitted confirmation message
         │    • Vacate_[Name].pdf attached
         │
         └──► Admin receives:
              • "New Vacate Request" summary
              • Vacate PDF
              • Reply: VACATE [Room] to confirm
              • Push notification + dashboard alert
```

---

## 13. Help / Queries Flow

**Trigger:** `HELP` command  OR  tap "❓ Queries" from menu

### Via WhatsApp HELP command
```
Tenant types HELP
         │
         ▼
┌──────────────────────────────────┐
│  "How can we help you today?"    │
│  [🔧 Maintenance]               │
│  [💰 Payment Issue]             │
│  [👤 Profile Update]            │
│  [🚪 Vacate Room]               │
│  [❌ Cancel]                    │
│  session → HELP_CATEGORY        │
└────────────────┬─────────────────┘
                 │ Tenant taps category
                 ▼
         "Please describe your issue"
         session → HELP_REASON
                 │
                 │ Tenant types description
                 ▼
         ┌──────────────────────────────────┐
         │  ✅ "Complaint Registered!"      │
         │  Category + Issue shown          │
         └──────────────┬───────────────────┘
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
     Tenant gets            Admin gets:
     confirmation         • Tenant name, room
                          • Category, issue text
                          • Direct reply phone
                          • Dashboard notification
```

### Via Queries Web Form (menu → Queries)
```
Tenant taps Queries from menu
         │
         ▼
Bot sends CTA button → Opens queries.html form
         │
         Tenant fills: Name, Phone, Category, Description
         │
         ▼
POST /api/submit-query
→ Generate query ID (Q1001, Q1002...)
→ Save to MongoDB Query collection
         │
         ├──► Tenant WhatsApp: "✅ Query Received #Q1001"
         └──► Admin WhatsApp: "🚩 New Issue #Q1001"
              Dashboard + Push notification

Admin replies via dashboard or POST /api/queries/:id/reply
         │
         ▼
Tenant WhatsApp: "💬 Admin Reply — Query #Q1001"
Status → RESOLVED

Auto-reply if no response after 1 hour (cron):
"We are working on it. Thank you for patience."
Status → ACKNOWLEDGED
```

---

## 14. History & Receipt Flow

**Trigger:** `HISTORY` or `PREVIOUS PAYMENT`  OR  `RECEIPT` / `INVOICE`

```
Tenant types HISTORY
         │
         ▼
Fetch last 6 payments from Payments sheet
         │
         ▼
┌──────────────────────────────────────────┐
│  📜 Payment History                      │
│  ✅ June-2026 | ₹6500 | UPI             │
│  ✅ May-2026  | ₹6000 | Cash            │
│  ✅ Apr-2026  | ₹6200 | UPI             │
│  ✅ Mar-2026  | ₹6500 | UPI             │
│  ✅ Feb-2026  | ₹6000 | UPI             │
│  ✅ Jan-2026  | ₹6500 | Cash            │
│                                          │
│  "Need to add old payment? Send screenshot"│
└──────────────────────────────────────────┘

Tenant types RECEIPT or INVOICE
         │
         ▼
Status = PAID?
   ┌─────┴─────┐
   YES         NO
   │            │
   ▼            ▼
Generate    "No payment recorded yet.
Invoice     Type PAID to record, then
PDF         type RECEIPT."
   │
   ▼
Send PDF to tenant
```

---

## 15. Refer a Friend Flow

**Trigger:** Tap "👥 Refer a Friend" from menu

```
Tenant taps Refer a Friend
         │
         ▼
Build referral link:
[FORM_URL]?ref=[tenantPhone]
         │
         ▼
┌──────────────────────────────────────────┐
│  👥 Refer a Friend                       │
│  Hi [Name]!                              │
│  Know someone looking for a great PG?    │
│                                          │
│  📲 Share this link:                     │
│  https://forms.../register?ref=91xx      │
│                                          │
│  🎁 Benefits:                            │
│  • Friend gets smooth onboarding         │
│  • You may receive special discounts!    │
└──────────────────────────────────────────┘
         │
         ▼
[📤 Share Link] CTA button

```

---

## 16. Holiday List & Rules

**Holiday List trigger:** Tap "🎉 Holiday List" from menu
```
Bot sends Holiday List banner image
+ Full holiday list text (National holidays + PG specific)
```

**Rules trigger:** Tap "📋 Rules" from menu  OR  type `RULES`
```
Bot sends Rules banner image
+ Full PG House Rules:
  ⚖️ DO's (5 rules)
  🚫 DON'Ts (5 rules)
  📜 Note about violations
```

---

## 17. Gemini AI Fallback

Any message that doesn't match a known command hits `handleSmartChat()` first, then `handleGeminiChat()`.

```
Unknown message received
         │
         ▼
┌─────────────────────────────────────────────────┐
│  handleSmartChat() — keyword matching           │
│                                                 │
│  "bill" / "due" / "amount"  → show bill        │
│  "eb" / "electricity"       → show EB amount   │
│  "history" / "previous"     → show history     │
│  "receipt" / "invoice"      → send PDF         │
│  "pay" / "upi" / "gpay"     → payment flow     │
│  "status" / "paid or not"   → show status      │
└─────────────────────────────┬───────────────────┘
                              │ no keyword match
                              ▼
                   handleGeminiChat()
                              │
                    Gemini available?
                    Rate-limited? → fallback menu
                              │
                              ▼
                   Build system prompt with:
                   • Tenant's name, room, rent, EB
                   • Available commands list
                   • Rules: be concise, friendly,
                     use Hindi words (ji, bhai),
                     never make up bill amounts
                              │
                              ▼
                   Gemini generates 2–4 line response
                              │
                              ▼
                   Send to tenant

Rate limit hit (429):
  → back off 60 seconds
  → send fallback command list instead
  → no error shown to user
```

---

## 18. Automated Cron Messages

These messages arrive without the tenant doing anything.

```
┌─────────────────────────────────────────────────────────────┐
│  Schedule          │ What tenant receives                   │
├────────────────────┼────────────────────────────────────────┤
│ 1st of month 9AM   │ 🚀 Monthly bill with Razorpay link     │
│                    │    Rent + EB + Total + Due date         │
├────────────────────┼────────────────────────────────────────┤
│ 3rd of month 9AM   │ 🔔 Friendly reminder (if still PENDING)│
│                    │    Amount + Due date + Pay link         │
├────────────────────┼────────────────────────────────────────┤
│ 5th of month 9AM   │ ⚠️ FINAL REMINDER (if still PENDING)  │
│                    │    "Due date is today" + Pay link       │
├────────────────────┼────────────────────────────────────────┤
│ 10th of month 9AM  │ ⚠️ Overdue alert (if still PENDING)   │
│                    │    "Pay before 11th" + Pay link         │
├────────────────────┼────────────────────────────────────────┤
│ 11th of month 9AM  │ 🚨 FINAL WARNING (if still PENDING)   │
│                    │    "Late fee applies"                   │
├────────────────────┼────────────────────────────────────────┤
│ Every hour         │ ⏰ Cash payment 24h timeout            │
│                    │    If PENDING CASH > 24h:              │
│                    │    Tenant: "Payment still processing"  │
│                    │    Admin: "Verify or Reject" reminder  │
│                    │    (fires once per payment only)       │
├────────────────────┼────────────────────────────────────────┤
│ Every 30 min       │ 🔔 Query auto-reply                    │
│                    │    If query pending > 1hr:             │
│                    │    "We are working on it..."           │
│                    │    Status → ACKNOWLEDGED               │
└────────────────────┴────────────────────────────────────────┘
```

---

## 19. Session & Escape Mechanism

```
Multi-step flows (registration, payment, vacate, help)
use MongoDB Sessions with 1-hour TTL.

Session state fields:
  step          — current step name
  contextName   — tenant's name (for lookup)
  vacateData    — vacate form data accumulator
  expectedTotalPaise — locked bill amount
  amountPaidPaise    — tenant's entered amount
  helpCategory  — selected help category

ESCAPE KEYWORDS (reset any stuck session):
  HI / HELLO / NAMASTE / HEY / HAI
  CANCEL / STOP / QUIT / EXIT
  RENT / STATUS / PAID

┌─────────────────────────────────────────────┐
│  User in session + types escape keyword     │
│              │                              │
│              ▼                              │
│  Session CLEARED                            │
│  Continue to main switch as fresh message   │
└─────────────────────────────────────────────┘

Concurrency:
  Per-user lock via in-memory Map.
  If two messages arrive simultaneously for same phone:
  → second message is DROPPED (not queued)
  → prevents double-processing race conditions
```

---

## 20. Status Values Reference

```
┌──────────────┬──────────────────────────────────────────────┐
│  Status      │  Meaning                                     │
├──────────────┼──────────────────────────────────────────────┤
│  ACTIVE      │  New tenant, no bill sent yet                │
│  PENDING     │  Bill sent / payment submitted, awaiting     │
│              │  verification                                │
│  PAID        │  Razorpay auto-verified                      │
│  VALID       │  Admin-verified (UPI or Cash)                │
│  INVALID     │  Admin rejected payment                      │
│  VACATED     │  Tenant has left — no bot access             │
└──────────────┴──────────────────────────────────────────────┘

Invoice generation rules:
  ✅ Generated when: Razorpay webhook confirms, Admin VERIFY,
                     Admin marks paid via dashboard
  ❌ NOT generated:  On cash/UPI submission (PENDING state),
                     On rejection (INVALID state)
```

---

## 🗺️ Complete Tenant Lifecycle at a Glance

```
DISCOVERS PG
    │
    ▼ types HI
SEES WELCOME MENU
    │
    ▼ taps New Register
REGISTRATION (6 steps)
    │ Name → Phone → Room → Sharing → Advance → Aadhaar
    ▼
ACTIVE TENANT
    │
    ├── Types HI → personalised dashboard
    ├── Types RENT → invoice + pay buttons
    ├── Types PAID → payment flow (Razorpay OR Cash)
    ├── Types EB → electricity bill
    ├── Types STATUS → PAID/PENDING/VALID
    ├── Types HISTORY → last 6 payments
    ├── Types RECEIPT → PDF invoice
    ├── Types HELP → 3-step complaint
    ├── Types RULES → PG rules
    ├── Types ADVANCE → deposit info
    │
    │  [Every month — automated]
    ├── 1st  → Bill arrives
    ├── 3rd  → Reminder if unpaid
    ├── 5th  → Final reminder
    ├── 10th → Overdue alert
    ├── 11th → Final warning
    │
    ▼ types VACATE
VACATE REQUEST (3 steps)
    │ Reason → Date → Feedback → Confirm
    ▼
ADMIN APPROVES → Status = VACATED
    │
    ▼
VACATED STATE
    (bot sends "tenancy ended" for any future message)
    (re-admission only via admin)
```

---
*Generated from live codebase — src/bot.js, src/cron.js, src/index.js*
*StayFlow v1.0.0 — June 2026*
