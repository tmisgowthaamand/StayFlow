# 🏠 StayFlow — Complete System Flow & Architecture

> **StayFlow** is a WhatsApp-first PG/Hostel management system that automates tenant onboarding, rent billing, payment tracking, EB (electricity) billing, and vacancy management.

---

## 📐 System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         STAYFLOW SYSTEM                             │
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────┐ │
│  │  WhatsApp     │   │  React       │   │  Google Sheets           │ │
│  │  Cloud API    │◄──│  Dashboard   │──►│  (Primary Database)      │ │
│  │  (Bot Engine) │   │  (Admin UI)  │   │                          │ │
│  └──────┬───────┘   └──────┬───────┘   └────────────┬─────────────┘ │
│         │                  │                         │               │
│  ┌──────▼───────┐   ┌──────▼───────┐   ┌────────────▼─────────────┐ │
│  │  Node.js /   │   │  Express.js  │   │  jsPDF / AutoTable       │ │
│  │  Express     │◄──│  REST API    │──►│  (PDF Generation)        │ │
│  │  Backend     │   │              │   │                          │ │
│  └──────┬───────┘   └──────────────┘   └──────────────────────────┘ │
│         │                                                            │
│  ┌──────▼───────┐   ┌──────────────┐   ┌──────────────────────────┐ │
│  │  Gemini AI   │   │  Razorpay    │   │  MongoDB                 │ │
│  │  (Smart Chat │   │  (Online     │   │  (Activity Logs /        │ │
│  │   Fallback)  │   │   Payments)  │   │   Reports)               │ │
│  └──────────────┘   └──────────────┘   └──────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project File Structure

```
StayFlow/
├── src/
│   ├── index.js          → Express server + webhook + cron jobs
│   ├── bot.js            → WhatsApp bot engine (all commands & flows)
│   ├── sheets.js         → Google Sheets read/write service
│   ├── pdfService.js     → Invoice & Registration PDF generation
│   ├── config.js         → Environment config + command mappings
│   ├── wweb.js           → WhatsApp Web fallback engine
│   ├── models/
│   │   ├── Log.js        → MongoDB activity log schema
│   │   └── Report.js     → MongoDB AI report schema
├── dashboard/
│   ├── src/
│   │   ├── App.jsx       → Main React dashboard app
│   │   ├── App.css       → Dashboard styling
│   │   └── main.jsx      → React entry point
│   ├── index.html        → Dashboard HTML shell
├── assets/               → Images (logo, banners)
├── uploads/              → Generated PDFs storage
├── package.json          → Dependencies
├── .env                  → Environment variables
├── render.yaml           → Render deployment config
└── FLOW.md               → This file
```

---

## 🔀 Message Routing (How WhatsApp Messages Are Processed)

```
Incoming WhatsApp Message
        │
        ▼
┌───────────────────┐
│ handleIncoming()  │
│                   │
│ 1. Log to MongoDB │
│ 2. Clean body     │
└────────┬──────────┘
         │
    ┌────▼─────────────────┐         ┌──────────────────────┐
    │ User has active state?│── YES ──► handleOnboarding()   │
    │ (multi-step flow)    │         │ (continue the flow)  │
    └────────┬─────────────┘         └──────────────────────┘
             │ NO
    ┌────────▼─────────────┐         ┌──────────────────────┐
    │ Smart payment text?  │── YES ──► handleSmartPayment() │
    │ "paid by upi" etc    │         │ (direct payment)     │
    └────────┬─────────────┘         └──────────────────────┘
             │ NO
    ┌────────▼─────────────┐         ┌──────────────────────┐
    │ Owner command?       │── YES ──► handleOwnerCommand()  │
    │ (from owner phone)   │         │                      │
    └────────┬─────────────┘         └──────────────────────┘
             │ NO
    ┌────────▼─────────────┐         ┌──────────────────────┐
    │ Known command match? │── YES ──► Execute command       │
    │ HI/RENT/PAID/HELP..  │         │ (switch-case)        │
    └────────┬─────────────┘         └──────────────────────┘
             │ NO
    ┌────────▼─────────────┐
    │ Gemini AI Fallback   │
    │ (Smart chat response)│
    └──────────────────────┘
```

---

## 👤 Tenant Commands (Quick Reference)

```
┌─────────────────────────────────────────────────────────────┐
│                    TENANT COMMANDS                           │
├──────────┬──────────────────────────────────────────────────┤
│ HI/HELLO │ Shows Interactive List Menu with 9 options:       │
│ HAI/HEY  │ → Dynamic: New Register OR Vacate (if registered)│
│ NAMASTE  │ → Rent, EB Bill, Statements, Queries             │
│          │ → Holidays, Rules, Vacancy, Refer a Friend       │
│          │ → Registered users see personalized dashboard    │
├──────────┼──────────────────────────────────────────────────┤
│ JOIN     │ Shows registration form URL                      │
│          │ → Sends JOIN banner image                        │
├──────────┼──────────────────────────────────────────────────┤
│ RENT     │ Generates PDF invoice & sends to tenant          │
│          │ → If PAID: sends receipt only                    │
│          │ → If PENDING: shows pay buttons (UPI/Cash)       │
├──────────┼──────────────────────────────────────────────────┤
│ EB       │ Shows current electricity bill amount            │
├──────────┼──────────────────────────────────────────────────┤
│ STATUS   │ Shows payment status (PAID/PENDING)              │
├──────────┼──────────────────────────────────────────────────┤
│ PAID     │ Starts payment flow → UPI/APP or Cash or Cancel  │
├──────────┼──────────────────────────────────────────────────┤
│ CASH PAID│ Direct cash payment flow → Enter amount          │
├──────────┼──────────────────────────────────────────────────┤
│ HISTORY  │ Shows last 6 payment records                     │
├──────────┼──────────────────────────────────────────────────┤
│ ADVANCE  │ Shows advance deposit amount                     │
├──────────┼──────────────────────────────────────────────────┤
│ RULES    │ Sends full PG house rules (DO's & DON'Ts)        │
├──────────┼──────────────────────────────────────────────────┤
│ HELP     │ 3-button category → Describe issue → Owner notif │
├──────────┼──────────────────────────────────────────────────┤
│ VACATE   │ Sends vacate request to owner                    │
└──────────┴──────────────────────────────────────────────────┘
```

---

## 👑 Owner/Admin Commands (Quick Reference)

```
┌─────────────────────────────────────────────────────────────┐
│                     OWNER COMMANDS                          │
├────────────────┬────────────────────────────────────────────┤
│ TOTAL TENANTS  │ Count of all active tenants                │
├────────────────┼────────────────────────────────────────────┤
│ PAID LIST      │ List of tenants who paid this month        │
├────────────────┼────────────────────────────────────────────┤
│ PENDING LIST   │ List of tenants with pending payment       │
├────────────────┼────────────────────────────────────────────┤
│ DASHBOARD      │ Sends dashboard URL to owner               │
├────────────────┼────────────────────────────────────────────┤
│ SEND BILL      │ Sends invoice PDF to ALL tenants           │
├────────────────┼────────────────────────────────────────────┤
│ SEND REMINDER  │ Sends reminder to PENDING tenants only     │
├────────────────┼────────────────────────────────────────────┤
│ ANNOUNCE       │ Broadcast message to all tenants           │
├────────────────┼────────────────────────────────────────────┤
│ SET EB 101 150 │ Set EB units for Room 101 = 150 units      │
├────────────────┼────────────────────────────────────────────┤
│ VACATE 101     │ Mark Room 101 tenant as vacated            │
├────────────────┼────────────────────────────────────────────┤
│ MARK CASH 91xx │ Mark tenant phone as cash paid             │
└────────────────┴────────────────────────────────────────────┘
```

---

## 💰 Payment Flow (Complete — Updated)

### How Tenant Triggers Payment

Tenant can start the payment flow in **4 ways**:

```
1. Type "PAID"       → Interactive 3-button selector
2. Type "RENT"       → Invoice PDF + payment buttons
3. Type "paid by upi"  → Direct UPI flow (Razorpay + UPI link)
4. Type "paid by cash" → Direct Cash flow (enter amount)
```

### Option 1: Type "PAID" — Interactive Button Flow

```
Tenant types: PAID
        │
        ▼
┌─────────────────────────────────┐
│ 💳 Select payment method:       │
│                                 │
│ 🏠 Rent: ₹6000                 │
│ ⚡ EB: ₹500                    │
│ ━━━━━━━━━━━━━━━━━━━━            │
│ 💵 Total Due: ₹6500            │
│                                 │
│  ┌──────────┐                   │
│  │ UPI/APP  │  ← Button 1      │
│  └──────────┘                   │
│  ┌──────────┐                   │
│  │ Cash     │  ← Button 2      │
│  └──────────┘                   │
│  ┌──────────┐                   │
│  │ Cancel   │  ← Button 3      │
│  └──────────┘                   │
└────────┬────────────────────────┘
         │
    ┌────┼────────────────┐
    │    │                │
    ▼    ▼                ▼
  UPI  Cash            Cancel
  Flow Flow          (exit flow)
```

### UPI/APP Flow (after selecting UPI/APP button)

```
┌─────────────────────────────────────┐
│ 💳 Pay via UPI/APP                  │
│                                     │
│ 🏠 Rent: ₹6000                     │
│ ⚡ EB: ₹500                        │
│ ━━━━━━━━━━━━━━━━━━━━                │
│ 💰 Total: ₹6500                    │
│                                     │
│ 👇 Pay using UPI:                   │
│ upi://pay?pa=owner@upi&am=6500     │
│                                     │
│ 🔗 Pay Online (Razorpay):          │
│ https://rzp.io/i/xxxx              │
│ ✅ After paying, you'll be          │
│ redirected back here.              │
│                                     │
│ ┌────────────────────┐              │
│ │  ☑ Pay Now         │ ← Razorpay  │
│ └────────────────────┘              │
│                                     │
│ 📩 After payment, send your         │
│ Transaction ID / UTR Number here.   │
└────────────────┬────────────────────┘
                 │
    ┌────────────┼──────────────┐
    │            │              │
    ▼            ▼              ▼
 Tap UPI     Tap "Pay Now"   Type TXN ID
  Link       (Razorpay)      directly
    │            │              │
    ▼            │              │
 UPI App        │              │
 Opens          ▼              │
    │     Razorpay Page        │
    │     Opens in Browser     │
    ▼            │              │
 Complete        ▼              │
 Payment    Complete Payment   │
    │            │              │
    │            ▼              │
    │     ✅ Redirected back    │
    │     to WhatsApp with     │
    │     "PAID BY UPI" text   │
    │            │              │
    └────────────┼──────────────┘
                 │
                 ▼
    Tenant sends TXN ID / UTR
                 │
                 ▼
┌────────────────────────────────┐
│ ✅ UPI Payment Confirmed!      │
│                                │
│ 📋 Breakdown:                  │
│ 🏠 Rent: ₹6000                │
│ ⚡ EB: ₹500                   │
│ 💰 Total Paid: ₹6500          │
│                                │
│ 💳 Mode: UPI                  │
│ 🔖 TXN ID: UTR123456789      │
│ 📅 Date: 10/02/2026           │
│                                │
│ Thank you! 🙏                  │
├────────────────────────────────┤
│ 📄 StayFlow_Invoice.pdf        │
│ (Receipt with PAID status)     │
└────────────────────────────────┘
         │
         ▼
  Owner gets notification:
  💰 UPI Payment
  Tenant: Ravi
  Room: 101
  Total: ₹6500
  TXN: UTR123456789
```

### Cash Flow (after selecting Cash button)

```
┌─────────────────────────────────┐
│ 💵 Cash Payment                 │
│                                 │
│ 🏠 Rent: ₹6000                 │
│ ⚡ EB: ₹500                    │
│ ━━━━━━━━━━━━━━━━━━━━            │
│ 💰 Total Due: ₹6500            │
│                                 │
│ Please enter the amount paid.   │
│ Example: 6500                   │
└────────────────┬────────────────┘
                 │
                 ▼
    Tenant types: 6500
                 │
                 ▼
┌────────────────────────────────┐
│ ✅ Cash Payment Confirmed!     │
│                                │
│ 📋 Breakdown:                  │
│ 🏠 Rent: ₹6000                │
│ ⚡ EB: ₹500                   │
│ 💰 Total Paid: ₹6500          │
│                                │
│ 💵 Mode: CASH                 │
│ 🔖 Receipt: CASH-123456       │
│ 📅 Date: 10/02/2026           │
│                                │
│ Thank you! 🙏                  │
├────────────────────────────────┤
│ 📄 StayFlow_Invoice.pdf        │
│ (Receipt with PAID status)     │
└────────────────────────────────┘
```

### Option 2: Type "RENT" — Invoice + Buttons

```
Tenant types: RENT
        │
        ▼
┌─────────────────────────────────┐
│ 🧾 Invoice & Payment            │
│                                 │
│ Hi Ravi,                        │
│ 💰 Total Due: ₹6500            │
│ 📅 Due Date: 5th February      │
│                                 │
│ 📋 Breakdown:                   │
│ 🏠 Rent: ₹6000                 │
│ ⚡ EB: ₹500                    │
│ ━━━━━━━━━━━━━━━━━━━━            │
│ 💵 Total: ₹6500                │
│                                 │
│ 💳 Pay Online:                  │
│ https://rzp.io/i/xxxx          │
│ ┌────────────────────┐          │
│ │  ☑ Pay Now         │          │
│ └────────────────────┘          │
│                                 │
│ 👇 Quick UPI Pay:               │
│ upi://pay?pa=owner@upi&am=6500 │
│                                 │
│ ━━━━━━━━━━━━━━━━━━━━            │
│ How did you pay? Tap below 👇   │
│                                 │
│  [💳 Paid by UPI] [💵 Paid Cash]│
├─────────────────────────────────┤
│ 📄 StayFlow_Invoice.pdf         │
│ (Attached as document)          │
└─────────────────────────────────┘
```

### Option 3: Type "paid by upi" — Smart Direct UPI

```
Tenant types: "paid by upi"
        │
        ▼ (handleSmartPayment detects it)
        │
    Same as UPI/APP flow above
    → Shows UPI link + Razorpay link
    → Asks for TXN ID
    → Generates receipt PDF
```

### Option 4: Type "paid by cash" — Smart Direct Cash

```
Tenant types: "paid by cash"
        │
        ▼ (handleSmartPayment detects it)
        │
    Same as Cash flow above
    → Asks for amount
    → Generates receipt PDF
```

### Smart Text Detection (All Triggers)

```
┌──────────────────────────┬────────────────────────────────┐
│ What tenant types         │ What StayFlow does             │
├──────────────────────────┼────────────────────────────────┤
│ "PAID"                   │ Shows 3 buttons: UPI/Cash/Cancel│
│ "RENT"                   │ Invoice PDF + payment buttons  │
│ "paid by upi"            │ Direct UPI flow               │
│ "paid upi"               │ Direct UPI flow               │
│ "pay by upi"             │ Direct UPI flow               │
│ "upi paid"               │ Direct UPI flow               │
│ "paid by cash"           │ Direct Cash flow (enter amount)│
│ "paid cash"              │ Direct Cash flow              │
│ "pay by cash"            │ Direct Cash flow              │
│ "cash paid"              │ Direct Cash flow              │
│ "COD"                    │ Direct Cash flow              │
│ "CASH PAID"              │ Direct Cash flow              │
│ "paid cash 6500"         │ Instant receipt (₹6500)       │
│ "PAID UTR123456789"      │ Instant receipt (UPI + TXN)   │
│ 1                        │ UPI (when in payment selector) │
│ 2                        │ Cash (when in payment selector)│
│ 3                        │ Cancel payment                │
└──────────────────────────┴────────────────────────────────┘
```

### Razorpay → WhatsApp Redirect

```
┌───────────────────────────────────────────────────────────┐
│ RAZORPAY PAYMENT → WHATSAPP REDIRECT FLOW                │
│                                                           │
│ 1. Bot generates Razorpay payment link with:              │
│    callback_url = "https://wa.me/<phone>?text=PAID BY UPI"│
│    callback_method = "get"                                │
│                                                           │
│ 2. Tenant taps "Pay Now" → Opens Razorpay in browser      │
│                                                           │
│ 3. Tenant completes payment on Razorpay                   │
│                                                           │
│ 4. Razorpay redirects to callback_url                     │
│    → Opens WhatsApp chat with pre-filled "PAID BY UPI"    │
│                                                           │
│ 5. Tenant sends the message → handleSmartPayment() fires  │
│    → Bot asks for TXN ID → Confirms payment → Receipt PDF │
└───────────────────────────────────────────────────────────┘
```

### What Happens After Payment Confirmation

```
┌──────────────────────────────────────────────┐
│ AFTER PAYMENT CONFIRMED (UPI or Cash)        │
│                                              │
│ 1. ✅ Update Google Sheet:                   │
│    → Status = "PAID"                         │
│    → Payment Mode = "UPI" or "CASH"          │
│    → Transaction ID = TXN/Receipt ID         │
│    → Paid Date = today's date                │
│                                              │
│ 2. 📝 Log to Payments sheet                  │
│    → Phone, Name, Month, Amount, Mode, TXN   │
│                                              │
│ 3. 📄 Generate Receipt PDF                   │
│    → StayFlow_Invoice.pdf with PAID status   │
│                                              │
│ 4. 📱 Send to Tenant:                        │
│    → Confirmation message                    │
│    → Receipt PDF attached                    │
│                                              │
│ 5. 👑 Notify Owner:                          │
│    → Payment details message                 │
│    → Tenant name, room, amount, TXN          │
└──────────────────────────────────────────────┘
```

---

## 📝 Registration Flow (3 Channels)

```
 ┌──────────┐    ┌──────────┐    ┌──────────┐
 │  WhatsApp│    │   Web    │    │  Google  │
 │   Bot    │    │  Form    │    │  Form    │
 │  (JOIN)  │    │register  │    │ webhook  │
 └────┬─────┘    └────┬─────┘    └────┬─────┘
      │               │               │
      ▼               ▼               ▼
┌─────────────────────────────────────────────┐
│            REGISTRATION PROCESS             │
│                                             │
│ 1. Collect: Name, Phone, Room, Sharing,     │
│             Advance, Aadhaar Upload          │
│                                             │
│ 2. Generate Registration PDF                │
│    (Details + PG House Rules)               │
│                                             │
│ 3. Add to Google Sheets                     │
│    (Tenants tab + Registration Form column) │
│                                             │
│ 4. Send to Tenant:                          │
│    → Welcome message + Rules                │
│    → StayFlow_Registration.pdf              │
│                                             │
│ 5. Send to Owner:                           │
│    → New registration notification          │
│    → StayFlow_Registration.pdf              │
└─────────────────────────────────────────────┘
```

---

## 🆘 HELP Flow

```
User types HELP
      │
      ▼
┌─────────────────────────┐
│  🆘 Need Help?          │
│                         │
│ [🔧 Maintenance]       │
│ [💰 Payment   ]        │
│ [📋 Other     ]        │
└────────┬────────────────┘
         │ (user taps)
         ▼
┌─────────────────────────┐
│ Category: Maintenance   │
│                         │
│ Please describe your    │
│ issue in detail.        │
└────────┬────────────────┘
         │ (user types issue)
         ▼
┌─────────────────────────┐
│  ✅ Complaint Registered│
│                         │
│  → Tenant gets confirm  │
│  → Owner gets:          │
│    • Tenant name & room │
│    • Category           │
│    • Full description   │
└─────────────────────────┘
```

---

## 📊 Dashboard (React App)

```
┌──────────────────────────────────────────────────┐
│              ADMIN DASHBOARD TABS                │
├──────────┬───────────────────────────────────────┤
│ Overview │ Stats cards, payment pie chart,       │
│          │ recent tenants table                  │
├──────────┼───────────────────────────────────────┤
│ Tenants  │ Full directory with Search,           │
│          │ Aadhaar view, Reg PDF view,           │
│          │ Receipt download, WhatsApp notify,    │
│          │ Mark paid, Edit, Remove               │
├──────────┼───────────────────────────────────────┤
│ Rooms    │ Live room mapping by floor,           │
│          │ Occupancy dots, vacancy status         │
├──────────┼───────────────────────────────────────┤
│ Broadcast│ Send message/file to all tenants      │
├──────────┼───────────────────────────────────────┤
│ Archive  │ Vacated tenants history               │
├──────────┼───────────────────────────────────────┤
│ Settings │ Read-only app configuration           │
└──────────┴───────────────────────────────────────┘
```

---

## 📄 PDF Documents Generated

```
┌───────────────────────────┬──────────────────────────────────────┐
│ StayFlow_Registration.pdf │ On new tenant registration           │
│                           │ → Resident details table             │
│                           │ → PG House Rules                     │
│                           │ → Sent to tenant + owner             │
├───────────────────────────┼──────────────────────────────────────┤
│ StayFlow_Invoice.pdf      │ On RENT command / Payment            │
│                           │                                      │
│                           │ INVOICE TABLE FORMAT:                │
│                           │ ┌─────────────┬─────┬───────────┬──────┐ │
│                           │ │ DESCRIPTION │ QTY │ UNIT PRICE│AMOUNT│ │
│                           │ ├─────────────┼─────┼───────────┼──────┤ │
│                           │ │ Monthly Rent│  1  │ Rs.6000   │6000  │ │
│                           │ │ Electricity │  1  │ Rs.500    │500   │ │
│                           │ ├─────────────┼─────┼───────────┼──────┤ │
│                           │ │ SUBTOTAL    │     │           │6500  │ │
│                           │ │ TOTAL       │     │           │6500  │ │
│                           │ └─────────────┴─────┴───────────┴──────┘ │
│                           │ → Payment status box (PAID/PENDING)  │
│                           │ → THANK YOU + footer                 │
├───────────────────────────┼──────────────────────────────────────┤
│ StayFlow_Receipt.pdf      │ After payment confirmed              │
│                           │ → Same invoice layout                │
│                           │ → With PAID status + TXN ID          │
│                           │ → Sent to tenant + owner             │
└───────────────────────────┴──────────────────────────────────────┘
```

---

## 🗄️ Google Sheets Structure

```
Sheet: Tenants
┌──────┬───────┬──────┬─────────┬──────────┬─────────┬──────────┬───────────────────┬──────────────┬───────────┬──────────────┬────────┬───────────┐
│ Name │ Phone │ Room │ Sharing │ Location │ Advance │ Aadhaar  │ Registration Form │ Monthly Rent │ EB Amount │ Payment Mode │ Status │ Paid Date │
│      │       │      │ Type    │          │         │ Image    │                   │              │           │              │        │           │
└──────┴───────┴──────┴─────────┴──────────┴─────────┴──────────┴───────────────────┴──────────────┴───────────┴──────────────┴────────┴───────────┘

Sheet: Payments   → Phone, Name, Month-Year, Rent, EB, Total, Mode, TXN, Date, Status
Sheet: History    → Name, Phone, Room, Month, Year, Amount, Mode, TRX_ID, Date
Sheet: Locations  → Location Name, Address, Total Rooms, Floors, Occupied, Unoccupied
Sheet: EB_Bills   → Month-Year, Location, Total Units, Rate, Calculated Total, Date
Sheet: Notif_Log  → Phone, Name, Message Type, Sent Date, Content, Status
```

---

## 🔐 Environment Variables (.env)

```
# Business
BUSINESS_NAME=StayFlow PG
OWNER_PHONE=919876543210
OWNER_UPI_ID=owner@upi
MONTHLY_RENT_DUE_DATE=5
EB_DUE_DATE=10
EB_UNIT_RATE=8

# WhatsApp Cloud API
WHATSAPP_TOKEN=EAAxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_VERIFY_TOKEN=stayflow_verify_token

# Google Sheets
GOOGLE_SHEET_ID=1xxxxxxxxxxxxxxxxxx
GOOGLE_SERVICE_ACCOUNT_EMAIL=stayflow@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/stayflow

# Gemini AI
GEMINI_API_KEY=AIzaSyxxxxxxx

# Razorpay (Optional)
RAZORPAY_KEY_ID=rzp_live_xxxx
RAZORPAY_KEY_SECRET=xxxxx

# Google Form
GOOGLE_FORM_URL=https://forms.gle/xxxxx
```

---

## ⏰ Recurring Automation (Cron Jobs)

```
┌────────────────────┬────────────────────────────────────────┐
│ Schedule           │ Action                                 │
├────────────────────┼────────────────────────────────────────┤
│ 1st of every month │ Reset all tenants' Status to PENDING   │
│ @ 12:00 AM         │ Clear Transaction IDs and Paid Dates   │
├────────────────────┼────────────────────────────────────────┤
│ 5th of every month │ Auto-send invoices to all tenants      │
│ @ 9:00 AM          │ with PENDING status                    │
├────────────────────┼────────────────────────────────────────┤
│ 10th of every month│ Send payment reminder to tenants       │
│ @ 9:00 AM          │ who still have PENDING status          │
└────────────────────┴────────────────────────────────────────┘
```

---

## 🌐 API Endpoints

```
GET  /                          → Health check
POST /webhook                   → WhatsApp webhook (incoming messages)
GET  /webhook                   → WhatsApp webhook verification

GET  /api/tenants               → Get all tenants
POST /api/tenants               → Add new tenant
PUT  /api/tenants/:phone        → Update tenant
DELETE /api/tenants/:phone      → Remove tenant

GET  /api/payments              → Get all payments
GET  /api/locations             → Get all locations
GET  /api/eb-bills              → Get EB bills
GET  /api/dashboard/stats       → Dashboard statistics

POST /api/send-message          → Send WhatsApp message
POST /api/send-media            → Send WhatsApp media
POST /api/broadcast             → Broadcast to all tenants
POST /api/upload-aadhaar        → Upload Aadhaar image
POST /api/submit-query          → Submit tenant query/complaint

POST /register                  → Web registration form
GET  /queries                   → Queries submission form
```

---

## 🔄 Complete Tenant Lifecycle — Step by Step

### 🟢 PHASE 1: TENANT DISCOVERS THE PG
```
Tenant sends "HI" or "HELLO" to bot number
        │
        ▼
Bot checks if tenant exists in Google Sheets
        │
    ┌───┴───┐
    │       │
  EXISTS  NOT FOUND
    │       │
    ▼       ▼
Dashboard  "Not registered.
Message    Type JOIN to start."
```

### 🟡 PHASE 2: REGISTRATION
```
Tenant types "JOIN"
        │
        ▼
Bot sends registration form URL + banner image
        │
        ▼
Tenant fills form (WhatsApp multi-step / Web form / Google Form)
        │
        ▼
System adds tenant to Google Sheets
        │
        ▼
Bot generates StayFlow_Registration.pdf
        │
        ▼
Bot sends to Tenant: Welcome + PDF
Bot sends to Owner: New registration + PDF
```

### 🔵 PHASE 3: DAILY LIFE
```
Tenant types various commands:
├── "HI"      → Personal dashboard with bill summary
├── "RULES"   → PG house rules
├── "EB"      → Current EB amount
├── "STATUS"  → PAID / PENDING status
├── "HISTORY" → Last 6 payments
├── "ADVANCE" → Advance deposit info
├── "HELP"    → Issue report (3-category flow)
└── Any text  → Gemini AI smart response
```

### 🟠 PHASE 4: RENT CYCLE
```
1st of Month → Cron resets all Status to PENDING
        │
        ▼
5th of Month → Cron sends invoices to PENDING tenants
        │
        ▼
10th of Month → Cron sends reminders to still-PENDING
```

### 🔴 PHASE 5: PAYMENT
```
See "💰 Payment Flow (Complete)" section above
```

### ⚫ PHASE 6: VACATING
```
Tenant types "VACATE"
        │
        ▼
Bot sends vacate request to owner
        │
        ▼
Owner processes via Dashboard or "VACATE 101" command
        │
        ▼
Tenant moved to Archive sheet
Room marked as vacant
```

---

*Last updated: February 2026*
