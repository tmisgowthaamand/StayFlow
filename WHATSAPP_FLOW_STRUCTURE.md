# WhatsApp Bot Flow Structure - StayFlow PG Management System

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Entry Points](#entry-points)
3. [User Flows](#user-flows)
4. [Admin Flows](#admin-flows)
5. [Payment Processing](#payment-processing)
6. [State Management](#state-management)
7. [Technical Architecture](#technical-architecture)

---

## 🎯 System Overview

**StayFlow** is a WhatsApp-based PG (Paying Guest) management system that handles:
- Tenant registration and onboarding
- Rent and electricity bill management
- Payment processing (Razorpay & Cash)
- Admin verification and monitoring
- Automated notifications and reminders

### Core Technologies
- **WhatsApp Integration**: Cloud API + WhatsApp Web.js (dual mode)
- **Payment Gateway**: Razorpay (UPI/Cards)
- **Database**: Google Sheets (primary) + MongoDB (secondary)
- **AI Assistant**: Google Gemini 2.0 Flash
- **Backend**: Node.js + Express

---

## 🚪 Entry Points

### 1. **Welcome Message (HI/HELLO/NAMASTE)**
```
User sends: HI, HELLO, HAI, HEY, NAMASTE, HOLA
↓
Bot checks registration status
↓
├─ Registered User → Shows personalized dashboard with:
│  ├─ Name, Room, Current Bill
│  ├─ Payment Status (✅ PAID / ⏳ PENDING)
│  └─ Interactive Menu (List Message)
│
└─ New User → Shows welcome message with:
   ├─ Business introduction
   └─ Registration option
```

**Interactive Menu Sections:**
- **🏠 Services**: Register/Vacate, Rent, Pay Bills, EB Bill, Statements, Queries
- **ℹ️ Information**: Holidays, Rules, Vacancy, Refer a Friend

---

## 👤 User Flows

### Flow 1: New Tenant Registration
```
User → Types "JOIN" or selects "📝 New Register"
↓
Bot sends Google Form link
↓
User fills form (Name, Phone, Room, Advance, etc.)
↓
Form submission triggers webhook
↓
Bot adds tenant to Google Sheets
↓
Confirmation message sent to user
↓
Admin notified of new registration
```

### Flow 2: View Rent & Bill
```
User → Types "RENT" or selects "🏠 Rent"
↓
Bot fetches tenant data from Google Sheets
↓
Displays breakdown:
├─ 🏠 Monthly Rent: ₹X
├─ ⚡ EB Amount: ₹Y
├─ 💰 Total: ₹(X+Y)
└─ 📊 Status: PAID/PENDING
↓
Shows payment buttons:
├─ 💳 Pay Now UPI (Razorpay)
└─ 💵 Pay Cash
```

### Flow 3: Online Payment (Razorpay)
```
User → Clicks "💳 Pay Now UPI"
↓
Bot generates Razorpay payment link
↓
User redirected to payment page (stay-flow-kohl.vercel.app)
↓
User completes payment via UPI/Card
↓
Razorpay webhook triggers verification
↓
Bot validates payment amount (fraud check)
↓
├─ Valid → Mark as PAID, generate invoice PDF
│  ↓
│  Send invoice to user + notify admin
│
└─ Invalid → Flag as fraud, notify admin
```

### Flow 4: Cash Payment
```
User → Selects "💵 Pay Cash"
↓
Bot asks: "Enter amount paid"
↓
User enters amount (e.g., 6500)
↓
Bot validates: amount >= total bill
↓
├─ Underpayment → Reject, ask again
└─ Valid → Ask for payment date
   ↓
   User enters date (e.g., "Today")
   ↓
   Bot creates CASH-XXXXXX transaction ID
   ↓
   Status: PENDING (awaiting admin verification)
   ↓
   Notify admin with verification command
```

### Flow 5: Payment History
```
User → Types "HISTORY" or selects "📜 Statements"
↓
Bot fetches last 6 months from Google Sheets
↓
Displays:
├─ ✅ January 2026: ₹6500 (UPI)
├─ ✅ December 2025: ₹6200 (Cash)
└─ ⏳ November 2025: ₹6000 (Pending)
```

### Flow 6: Monthly Statement
```
User → Selects "📜 Statements"
↓
Bot shows year selection (2024, 2025, 2026)
↓
User selects year
↓
Bot shows month list (Jan-Dec)
↓
User selects month (e.g., "February 2026")
↓
Bot displays detailed statement:
├─ 📅 Month: February 2026
├─ 🏠 Rent: ₹6000
├─ ⚡ EB: ₹500
├─ 💰 Total: ₹6500
├─ 💳 Mode: UPI (Razorpay)
├─ 🔖 TXN ID: pay_XXXXXXXXX
└─ ✅ Status: PAID
```

### Flow 7: EB Bill Inquiry
```
User → Types "EB" or selects "⚡ EB Bill"
↓
Bot shows:
├─ Room: 101
├─ EB Amount: ₹500
├─ Rate: ₹8/unit
└─ Total Due: ₹6500 (Rent + EB)
```

### Flow 8: Vacate Request
```
User → Types "VACATE" or selects "🚪 Vacate"
↓
Bot confirms room details
↓
Sends vacate request to admin
↓
Admin processes (clears dues, marks VACATED)
↓
Confirmation sent to user
```

### Flow 9: Help & Queries
```
User → Types "HELP" or selects "❓ Queries"
↓
Bot shows query form link
↓
User fills form (Issue, Description, Priority)
↓
Query logged in system
↓
Admin notified
```

### Flow 10: Smart AI Chat
```
User → Sends natural language query
(e.g., "How much do I owe?", "When is rent due?")
↓
Bot checks keyword matching first:
├─ Bill keywords → Show bill
├─ History keywords → Show history
├─ Payment keywords → Start payment flow
└─ No match → Forward to Gemini AI
   ↓
   Gemini generates contextual response
   ↓
   Bot sends friendly reply with command suggestions
```

---

## 👨‍💼 Admin Flows

### Admin Commands (Owner Phone Only)

#### 1. View Statistics
```
Admin → Types "TOTAL TENANTS"
↓
Bot shows:
├─ Total Active: 25
├─ Paid: 20
└─ Pending: 5
```

#### 2. View Lists
```
Admin → Types "PAID LIST" or "PENDING LIST"
↓
Bot shows filtered tenant list:
- Name (Room): Phone
```

#### 3. Dashboard
```
Admin → Types "DASHBOARD"
↓
Bot shows:
├─ Residents: 25
├─ ✅ Paid: 20
├─ ⏳ Pending: 5
├─ 💰 Revenue: ₹162,500
└─ 📈 Collection: 80%
```

#### 4. Update EB Bill
```
Admin → Types "SET EB [ROOM] [UNITS]"
Example: "SET EB 101 100"
↓
Bot calculates per-person EB (units × rate ÷ occupants)
↓
Updates all tenants in that room
↓
Sends notification to each tenant
↓
Confirms to admin
```

#### 5. Verify Cash Payment
```
Admin → Types "VERIFY CASH [PHONE]"
Example: "VERIFY CASH 919876543210"
↓
Bot fetches pending payment
↓
Generates invoice PDF
↓
Marks status as PAID
↓
Sends invoice to tenant
↓
Confirms to admin
```

#### 6. Verify UPI Payment
```
Admin → Types "VERIFY UPI [PHONE]"
↓
(Same flow as cash verification)
```

#### 7. Reject Payment
```
Admin → Types "REJECT [PHONE]"
↓
Bot marks payment as INVALID
↓
Notifies tenant to retry
↓
Confirms to admin
```

#### 8. Vacate Tenant
```
Admin → Types "VACATE [ROOM]"
Example: "VACATE 101"
↓
Bot marks all tenants in room as VACATED
↓
Sends checkout confirmation to tenants
↓
Confirms to admin
```

#### 9. Send Bills to All
```
Admin → Types "SEND BILL"
↓
Bot sends rent details to all ACTIVE tenants
↓
Confirms count to admin
```

#### 10. Send Reminders
```
Admin → Types "SEND REMINDER"
↓
Bot sends payment reminder to all PENDING tenants
↓
Confirms count to admin
```

#### 11. Broadcast Announcement
```
Admin → Types "ANNOUNCE"
↓
Bot asks: "What is the announcement?"
↓
Admin types message
↓
Bot broadcasts to all active tenants
```

---

## 💳 Payment Processing

### Payment Flow Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PAYMENT INITIATION                    │
└─────────────────────────────────────────────────────────┘
                           ↓
              ┌────────────┴────────────┐
              │                         │
         Razorpay                     Cash
              │                         │
              ↓                         ↓
    ┌─────────────────┐      ┌─────────────────┐
    │ Create Order    │      │ User Enters     │
    │ (Server-side)   │      │ Amount & Date   │
    └─────────────────┘      └─────────────────┘
              │                         │
              ↓                         ↓
    ┌─────────────────┐      ┌─────────────────┐
    │ User Pays on    │      │ Status: PENDING │
    │ Payment Page    │      │ (Awaiting Admin)│
    └─────────────────┘      └─────────────────┘
              │                         │
              ↓                         ↓
    ┌─────────────────┐      ┌─────────────────┐
    │ Webhook Verify  │      │ Admin Verifies  │
    │ Signature       │      │ (VERIFY CASH)   │
    └─────────────────┘      └─────────────────┘
              │                         │
              └────────────┬────────────┘
                           ↓
              ┌────────────────────────┐
              │   FRAUD VALIDATION     │
              │ (Amount Match Check)   │
              └────────────────────────┘
                           ↓
              ┌────────────┴────────────┐
              │                         │
         Valid Amount            Mismatch
              │                         │
              ↓                         ↓
    ┌─────────────────┐      ┌─────────────────┐
    │ Mark as PAID    │      │ Flag as FRAUD   │
    │ Generate Invoice│      │ Notify Admin    │
    │ Send to User    │      │ Status: PENDING │
    └─────────────────┘      └─────────────────┘
              │
              ↓
    ┌─────────────────┐
    │ Log to MongoDB  │
    │ (Idempotency)   │
    └─────────────────┘
              │
              ↓
    ┌─────────────────┐
    │ Sync to Sheets  │
    │ (Secondary)     │
    └─────────────────┘
              │
              ↓
    ┌─────────────────┐
    │ Push Notification│
    │ to Admin        │
    └─────────────────┘
```

### Payment Security Features

1. **Signature Verification**: Razorpay webhook signatures validated
2. **Amount Validation**: Prevents "Pay ₹1" exploits
3. **Idempotency**: Duplicate transactions blocked via MongoDB unique index
4. **Fraud Detection**: Mismatched amounts flagged and admin notified
5. **Dual Database**: MongoDB (primary) + Google Sheets (secondary)

---

## 🔄 State Management

### Session States (MongoDB)

The bot maintains user state for multi-step flows:

```javascript
{
  phone: "919876543210",
  state: {
    step: "CASH_AMOUNT",           // Current step
    contextName: "John Doe",        // Tenant name
    expectedTotalPaise: 650000,     // Expected amount (in paise)
    amountPaidPaise: 650000,        // Amount entered
    updatedAt: "2026-04-22T10:30:00Z"
  }
}
```

### State Flow Examples

#### Cash Payment State Machine
```
NULL → PAYMENT_METHOD → CASH_AMOUNT → CASH_DATE → NULL
```

#### Onboarding State Machine
```
NULL → NAME → PHONE_NUMBER → ROOM → ADVANCE → MONEY → DATE → TRANS_ID → NULL
```

#### Help State Machine
```
NULL → HELP_CATEGORY → HELP_DETAILS → NULL
```

### State Escape Keywords
Users can reset state anytime by typing:
- HI, HELLO, NAMASTE, HEY, HAI
- CANCEL, STOP, QUIT, EXIT
- RENT, STATUS, PAID

---

## 🏗️ Technical Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                      USER (WhatsApp)                     │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              WhatsApp Integration Layer                  │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │  Cloud API       │      │  WhatsApp Web.js │        │
│  │  (Primary)       │      │  (Fallback)      │        │
│  └──────────────────┘      └──────────────────┘        │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                   Express Server (Node.js)               │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Webhook Handler (/webhook)                      │  │
│  │  - Message routing                               │  │
│  │  - Command parsing                               │  │
│  │  - State management                              │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                    Business Logic Layer                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ bot.js       │  │ sheets.js    │  │ pdfService.js│ │
│  │ (Message     │  │ (Data CRUD)  │  │ (Invoices)   │ │
│  │  Handling)   │  │              │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                    External Services                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Google       │  │ MongoDB      │  │ Razorpay     │ │
│  │ Sheets API   │  │ (Sessions,   │  │ (Payments)   │ │
│  │ (Primary DB) │  │  Logs)       │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────┐  ┌──────────────┐                   │
│  │ Gemini AI    │  │ Push         │                   │
│  │ (Chat)       │  │ Notifications│                   │
│  └──────────────┘  └──────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

#### Incoming Message Flow
```
WhatsApp → Webhook → Express → bot.js → handleIncomingMessage()
                                              ↓
                                    ┌─────────┴─────────┐
                                    │                   │
                              Check Session      Check Command
                                    │                   │
                              ┌─────┴─────┐      ┌─────┴─────┐
                              │           │      │           │
                         Onboarding   Main Menu  Admin   Smart AI
                          Flow         Commands  Commands  Chat
```

#### Outgoing Message Flow
```
bot.js → sendMessage() → wweb.js (if ready) → WhatsApp Web.js
                              ↓ (fallback)
                         Cloud API → WhatsApp
```

### Database Schema

#### Google Sheets (Primary)
**Tenants Sheet:**
- Name, Phone, Room, Location
- Monthly Rent, EB Amount, Total Amount
- Status (ACTIVE/PENDING/PAID/VACATED)
- Payment Mode, Transaction ID, Paid Date
- Advance, Join Date

**Payment History Sheet:**
- Phone, Name, Month-Year
- Rent Amount, EB Amount, Total Amount
- Payment Mode, Transaction ID, Status, Paid Date

**Locations Sheet:**
- Name, Total Beds, Address

#### MongoDB (Secondary)
**Collections:**
- `sessions`: User state management
- `logs`: Activity logging
- `payments`: Payment records (with idempotency)
- `notifications`: In-app notifications
- `media`: Uploaded files metadata
- `tenants`: Synced tenant data

### API Endpoints

```
POST /webhook                    - WhatsApp message webhook
POST /webhook/razorpay           - Razorpay payment webhook
GET  /api/payment-info           - Fetch tenant bill details
POST /api/create-order           - Create Razorpay order
POST /api/verify-razorpay-payment - Verify payment signature
POST /api/verify-transaction     - Verify transaction ID
GET  /api/uploads/:filename      - Serve uploaded files
```

---

## 📊 Message Types

### 1. Text Messages
```javascript
await sendMessage(phone, "Hello! Welcome to StayFlow.");
```

### 2. Interactive Buttons
```javascript
await sendButtons(phone, "Choose payment method:", [
  "💳 Pay via Razorpay",
  "💵 Pay Cash",
  "❌ Cancel"
]);
```

### 3. Interactive List (Menu)
```javascript
await sendListMessage(
  phone,
  "🏠 StayFlow",                    // Header
  "Welcome! Select an option:",     // Body
  "📋 View Menu",                   // Button text
  [
    {
      title: "🏠 Services",
      rows: [
        { id: "menu_rent", title: "🏠 Rent", description: "View bill" },
        { id: "menu_pay", title: "💳 Pay", description: "Make payment" }
      ]
    }
  ]
);
```

### 4. CTA URL Button
```javascript
await sendCTAButton(
  phone,
  "Click below to pay securely",    // Body
  "💳 Pay Now",                      // Button text
  "https://payment-link.com",       // URL
  "💳 Secure Payment"                // Header (optional)
);
```

### 5. Media Messages
```javascript
await sendMedia(
  phone,
  "/path/to/invoice.pdf",
  "Your payment receipt",
  ["📞 Contact"],                    // Optional buttons
  "Invoice.pdf"                      // Display filename
);
```

---

## 🔔 Notification System

### In-App Notifications (MongoDB)
```javascript
{
  type: "payment_received",
  title: "💰 UPI Payment Received",
  body: "₹6500 received from John Doe (Room 101)",
  meta: {
    tenantName: "John Doe",
    room: "101",
    amount: 6500,
    mode: "UPI",
    trxId: "pay_XXXXXXXXX"
  },
  createdAt: "2026-04-22T10:30:00Z"
}
```

### Push Notifications (Remote)
Sent to admin's mobile app for:
- Payment received
- New registration
- EB bill split
- Vacate requests

---

## 🎨 User Experience Features

### 1. Smart Keyword Matching
Before AI, bot checks keywords:
- "bill", "due", "how much" → Show bill
- "history", "previous" → Show payment history
- "receipt", "invoice" → Generate PDF
- "pay", "payment", "upi" → Start payment flow

### 2. AI-Powered Chat (Gemini)
For unmatched queries, Gemini provides:
- Contextual responses based on tenant data
- Friendly tone with Hindi words (ji, bhai)
- Command suggestions
- Short, concise answers (2-4 lines)

### 3. Multi-Language Support
- English (primary)
- Hindi keywords supported (kitna, kab, etc.)
- Emojis for visual clarity

### 4. Error Handling
- Invalid inputs → Friendly correction messages
- Session timeouts → Auto-reset with escape keywords
- Payment failures → Retry options with admin contact

---

## 🔐 Security Features

### 1. Authentication
- Admin commands: Phone number verification
- Webhook: Signature verification (WhatsApp + Razorpay)

### 2. Payment Security
- Amount validation (prevents underpayment)
- Idempotency (duplicate transaction prevention)
- Fraud detection (amount mismatch alerts)

### 3. Rate Limiting
- API endpoints: 100 requests/15 min
- Payment endpoints: 10 requests/hour

### 4. Data Privacy
- PII masked in logs
- Secure file storage (hashed filenames)
- HTTPS-only communication

---

## 📈 Analytics & Monitoring

### Logged Events (MongoDB)
- `INCOMING_MESSAGE`: All user messages
- `PAYMENT_FRAUD_BLOCK`: Fraud attempts
- `RAZORPAY_WEBHOOK`: Payment confirmations
- `RAZORPAY_PAYMENT_VERIFIED`: Successful payments

### Dashboard Metrics
- Total tenants
- Paid vs Pending count
- Revenue collected
- Collection percentage

---

## 🚀 Deployment

### Environment Variables
```env
WHATSAPP_TOKEN=your_cloud_api_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_VERIFY_TOKEN=your_verify_token
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
GEMINI_API_KEY=your_gemini_key
MONGODB_URI=your_mongodb_uri
GOOGLE_SHEETS_CREDENTIALS=your_service_account_json
OWNER_PHONE=919876543210
```

### Hosting
- **Backend**: Render.com / Railway.app
- **Frontend**: Vercel (payment pages)
- **Database**: MongoDB Atlas + Google Sheets

---

## 📝 Command Reference

### User Commands
| Command | Description |
|---------|-------------|
| `HI` / `HELLO` | Show dashboard & menu |
| `JOIN` | Register as new tenant |
| `RENT` | View rent & EB bill |
| `PAID` | Record payment (UPI/Cash) |
| `STATUS` | Check payment status |
| `HISTORY` | View payment history |
| `EB` | View electricity bill |
| `RECEIPT` | Get invoice PDF |
| `HELP` | Raise complaint/query |
| `VACATE` | Request to leave |
| `RULES` | View PG rules |

### Admin Commands
| Command | Description |
|---------|-------------|
| `TOTAL TENANTS` | View statistics |
| `PAID LIST` | List paid tenants |
| `PENDING LIST` | List pending tenants |
| `DASHBOARD` | View admin dashboard |
| `SET EB [ROOM] [UNITS]` | Update EB bill |
| `VERIFY CASH [PHONE]` | Verify cash payment |
| `VERIFY UPI [PHONE]` | Verify UPI payment |
| `REJECT [PHONE]` | Reject payment |
| `VACATE [ROOM]` | Mark room as vacated |
| `SEND BILL` | Send bills to all |
| `SEND REMINDER` | Send payment reminders |
| `ANNOUNCE` | Broadcast message |

---

## 🎯 Key Takeaways

1. **Dual WhatsApp Integration**: Cloud API (primary) + Web.js (fallback)
2. **Dual Database**: MongoDB (primary) + Google Sheets (secondary)
3. **Payment Security**: Signature verification + amount validation + idempotency
4. **Smart Routing**: Keyword matching → AI fallback
5. **State Management**: MongoDB sessions for multi-step flows
6. **Admin Control**: Verification system for cash payments
7. **User-Friendly**: Interactive menus, buttons, and natural language support

---

**Generated on**: April 22, 2026  
**Version**: 1.0  
**System**: StayFlow WhatsApp Bot
