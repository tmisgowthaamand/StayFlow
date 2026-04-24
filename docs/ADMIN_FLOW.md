# StayFlow — Admin Flow

> End-to-end admin operations: Onboarding → Tenant Management → Billing → Payments → Monitoring → Vacating

---

## Overview

Admin is identified by `OWNER_PHONE` in environment config. Admin has two interfaces:
1. **WhatsApp Bot** — Quick commands for on-the-go management
2. **Web Dashboard** (`/admin`) — Full visual management with charts, tables, modals

---

## 1. Onboarding — New Tenant Registration

> Admin can register tenants via 3 methods. All paths end with the tenant in Google Sheets + MongoDB + WhatsApp confirmation.

---

### Method A: Admin Adds via Web Dashboard

**Where:** Dashboard → Members Tab → Click `+ New Resident` button

| Field | Required | Default |
|-------|----------|---------|
| Full Name | ✅ | — |
| Phone Number | ✅ | — |
| Room Number | Optional | Unassigned |
| Sharing Type | Optional | Unknown |
| Monthly Rent (₹) | Optional | 0 |
| PG Location | Optional | Main Branch |
| Aadhaar Upload | Optional | — |

**On Save:**
1. Calls `/api/add-tenant` → Added to Google Sheets → Auto-synced to MongoDB
2. Uploads Aadhaar via `/api/upload-aadhaar` if provided
3. 📱 Tenant receives WhatsApp: "✅ Registration Successful!" + PG Rules + Registration PDF
4. 📱 Admin notified: "📝 Admin Added Resident — Rahul, 91xxxxx"
5. 🔔 In-app + push notification: "👤 New Resident: Rahul"
6. Tenant appears immediately in Members table & Dashboard stats

---

### Method B: Tenant Self-Registers via Web Form

**Where:** `https://your-domain.com/register.html` (shared via WhatsApp menu or direct link)

**Form Fields:** Name, Phone, Location, Sharing Type, Room, Rent, Advance, Aadhaar Upload

**What Admin Sees:**
1. 📱 WhatsApp: "📝 New Public Registration — Rahul, Room 103, Phone: 91xxxxx" + Registration PDF
2. 🔔 Dashboard notification: "👤 New Resident: Rahul"
3. Tenant auto-appears in Members table with status `ACTIVE`

---

### Method C: Tenant Registers via WhatsApp Bot

**Trigger:** Tenant sends `JOIN` → Gets registration form link or starts step-by-step bot flow

**Bot Onboarding Steps:**
| Step | Bot Asks | Tenant Replies | AI Validation |
|------|----------|----------------|---------------|
| 1 | Welcome banner + form link | — | — |
| 2 | Your Full Name | `Rahul Deshmukh` | Validates real name |
| 3 | Confirm Phone Number | `9940089442` | Validates phone format |
| 4 | Room Number | `103` | Validates room ID |
| 5 | Sharing Type (1/2/3/4) | `3` | Maps: 1→₹9000, 2→₹7000, 3/4→₹6500 |
| 6 | Advance Paid | `5000` | Validates amount |
| 7 | Upload Aadhaar image | *sends photo* | Checks image exists |

**What Admin Sees:**
1. 📱 WhatsApp: "📝 New Registration Received — Rahul, Room 103" + Registration PDF
2. 🔔 Dashboard notification + push notification
3. Tenant appears in Sheets + MongoDB + Dashboard

---

### After Onboarding — What Admin Has:

```
Google Sheets:  New row with Name, Phone, Room, Rent, Status=ACTIVE, Join Date
MongoDB:        Synced tenant document (auto via _syncToMongo)
Dashboard:      Visible in Members table + Dashboard stats updated
WhatsApp:       Tenant confirmed + Registration PDF sent
```

---

## 2. Already Registered Tenant — How It Works for Admin

> Once a tenant is registered, they appear across all systems. Here's how admin interacts with them day-to-day.

---

### What Admin Sees for Each Tenant

#### In Dashboard (Members Tab):
Each tenant row shows:
| Column | Example |
|--------|---------|
| **Name** | Rahul D (with avatar initial "R") |
| **Phone** | 9940089442 |
| **Room** | 103 (blue badge) |
| **Rent** | ₹7,000 |
| **EB** | ₹430 |
| **Join Date** | 01/03/2026 |
| **Status** | ✅ PAID (green badge) or ⏳ PENDING (yellow badge) |
| **Aadhaar** | View link (opens uploaded image) |
| **Reg Form** | View link (opens registration PDF) |
| **Actions** | 6 action buttons (see below) |

#### In WhatsApp:
When tenant sends `HI`, bot automatically shows their personalized dashboard:
```
Welcome back, Rahul! 👋
🚪 Room: 103
✅ Status: PAID
💰 Rent: ₹7000 | EB: ₹430 | Total: ₹7430
→ Interactive menu with all options
```

---

### Admin Actions on Existing Tenant (Dashboard)

| # | Action | How | What Happens |
|---|--------|-----|-------------|
| 1 | **View Details** | Members Tab → See row | All info visible in table |
| 2 | **Send Custom Message** | Click ✈ Send → Type message → Send | WhatsApp message sent to tenant |
| 3 | **Send Bill/Invoice** | Click 🔔 Bell | Personalized invoice PDF + Razorpay link sent via WhatsApp |
| 4 | **Download Receipt** | Click 💳 Receipt | Invoice PDF generated & downloaded |
| 5 | **Record Payment** | Click ✅ Mark Paid → Enter amount + mode | Status→VALID, Receipt sent, Sheets+MongoDB updated |
| 6 | **Edit Info** | Click ✏️ Edit → Modify fields → Save | Updates name/phone/room/rent/EB/status in Sheets+MongoDB |
| 7 | **Change Payment Status** | Click status badge (PAID/PENDING) | Toggle between paid↔pending with confirmation |
| 8 | **Delete Tenant** | Click 🗑️ Delete → Confirm | Removed from Sheets + MongoDB |

---

### Admin Actions on Existing Tenant (WhatsApp)

| # | Command | What Happens |
|---|---------|-------------|
| 1 | `TOTAL TENANTS` | Lists all tenants: "1. Rahul (Room 103) — PAID" |
| 2 | `PAID LIST` | Lists only paid tenants with amounts |
| 3 | `PENDING LIST` | Lists only unpaid/pending tenants |
| 4 | `SET EB 103 150` | Updates Rahul's EB = 150 × ₹15 = ₹2,250 |
| 5 | `MARK CASH 919940089442` | Directly marks Rahul as paid via cash |
| 6 | `VERIFY UPI 919940089442` | Verifies Rahul's UPI payment → sends receipt |
| 7 | `VERIFY CASH 919940089442` | Verifies Rahul's cash payment → sends receipt |
| 8 | `REJECT 919940089442` | Rejects Rahul's payment → notifies tenant |
| 9 | `VACATE 103` | Marks Rahul as VACATED → frees Room 103 |
| 10 | `SEND BILL` | Sends bill to ALL active tenants (including Rahul) |
| 11 | `SEND REMINDER` | Sends reminder to unpaid tenants only |

---

### Tenant Lifecycle Status Flow (Admin Perspective)

```
NEW REGISTRATION
    │
    ▼
  ACTIVE ──────────────────────────────────────────┐
    │                                                │
    │ Admin sends SEND BILL                         │
    ▼                                                │
  Tenant receives invoice + payment link             │
    │                                                │
    ├── Tenant pays via Razorpay ──→ Auto-VALID ───┤
    │                                                │
    ├── Tenant pays Cash ──→ PENDING ──┐            │
    │                           │       │            │
    │                  Admin: VERIFY ──→ VALID ─────┤
    │                           │                    │
    │                  Admin: REJECT ──→ ACTIVE ────┘
    │
    ├── Admin clicks Mark Paid (Dashboard) ──→ VALID
    │
    ├── Admin edits status in Edit Modal ──→ PAID/VALID
    │
    └── Next month resets ──→ ACTIVE (cycle repeats)

  At any point:
    Tenant sends VACATE ──→ Admin receives request
    Admin: VACATE 103 ──→ VACATED (tenant removed from active list)
```

---

### What Tenant Can Do (That Admin Sees)

| Tenant Action | Admin Notification |
|---------------|-------------------|
| Sends `HI` | — (no notification, just tenant views their dashboard) |
| Sends `RENT` | — (tenant views their own bill) |
| Pays via Razorpay | 📱 "💰 Money In — Rahul, ₹7430, UPI" + 🔔 Dashboard notification |
| Pays Cash | 📱 "💵 Cash Payment — Needs Verification" + 🔔 Dashboard notification |
| Sends `HELP` + complaint | 📱 "🆘 Help Request — Maintenance, Room 103" + 🔔 Dashboard notification |
| Sends `VACATE` | 📱 "🚪 VACATE REQUEST — Rahul, Room 103" + 🔔 Dashboard notification |
| Registers (self) | 📱 "📝 New Registration" + PDF + 🔔 Dashboard notification |

---

## 3. Tenant Management (Detailed Operations)

---

### View All Tenants

#### Via Dashboard:
- **Members Tab** → Full table with search, filter by location
- **Summary Bar** → Total: 20 | Paid: 16 | Pending: 4

#### Via WhatsApp:
| Command | Result |
|---------|--------|
| `TOTAL TENANTS` | Lists all tenants with room + status |
| `PAID LIST` | Lists only paid tenants with amounts |
| `PENDING LIST` | Lists only pending/unpaid tenants |

---

### Edit Tenant Info

#### Via Dashboard:
**Members Tab** → Click ✏️ Edit button → **Edit Resident Modal**

| Section | Fields |
|---------|--------|
| **Basic Info** | Full Name, Phone Number |
| **Room** | Room Number, Sharing Type (1/2/3/4) |
| **Billing** | Rent (₹), EB Bill (₹) |
| **Location** | PG Location |
| **Aadhaar** | Upload/replace Aadhaar image |
| **Payment Status** | Status dropdown (PAID/VALID/PENDING/ACTIVE), Payment Mode (Cash/UPI/Razorpay/Bank) |
| **Join Date** | Read-only |

**On Save:**
1. `/api/update-and-notify` → Updates Sheets (auto-syncs to MongoDB)
2. If status changed to PAID/VALID from unpaid → also calls `/api/mark-paid`:
   - Logs payment, generates invoice PDF
   - Sends WhatsApp receipt to tenant
   - Creates in-app + push notification

---

### Send Custom Message to Individual

**Members Tab** → Click ✈ Send button → **Custom Message Panel**

| Field | Description |
|-------|-------------|
| To | Tenant name (read-only) |
| Phone | Tenant phone (read-only) |
| Room | Tenant room (read-only) |
| Message | Textarea — type any message |

**On Send:** Message sent via WhatsApp to that specific tenant.

---

### Delete / Remove Tenant

**Members Tab** → Click 🗑️ Delete → Confirm → Removed from Sheets + MongoDB

---

### Notifications Admin Receives Automatically

| Event | WhatsApp Notification | Dashboard Notification |
|-------|----------------------|----------------------|
| New Registration | "📝 New Registration — Rahul, Room 103" + PDF | 🔔 "👤 New Resident: Rahul" |
| UPI Payment | "💰 Money In — Rahul, ₹7430, UPI" | 🔔 "Payment Received" |
| Cash Payment (needs verify) | "💵 Cash Payment — Needs Verification" + `VERIFY CASH xxxxx` | 🔔 "Cash Recorded" |
| Vacate Request | "🚪 VACATE REQUEST — Rahul, Room 103" | 🔔 "Vacate Request" |
| Help/Complaint | "🆘 Help Request — Maintenance, Room 103" | 🔔 "New Issue" |

---

## 3. Monthly Billing & EB Setup

---

### Set EB Amount

#### Via WhatsApp:
```
SET EB 103 150
→ Calculates: 150 units × ₹15/unit = ₹2,250
→ Updates EB Amount in Sheets + MongoDB
→ Recalculates total amount
```

#### Via Dashboard:
**Auto-Tools Tab** → EB Auto Split Tool → Enter Room + Units → "Calculate & Notify Residents"

---

### Send Bills to All Tenants

#### Via WhatsApp:
```
SEND BILL
→ Sends personalized invoice PDF + payment buttons to ALL active tenants
→ Each tenant gets: Rent breakdown + Razorpay link + Pay Cash option
```

#### Via Dashboard:
**Dashboard Tab** → Click "Notify All" button → Sends bills to all unpaid tenants

**Members Tab** → Click 🔔 Bell on individual tenant → Sends bill to that person only

---

### Send Reminders (Unpaid Only)

#### Via WhatsApp:
```
SEND REMINDER
→ Sends payment reminder ONLY to unpaid/pending tenants
→ Includes due date warning
```

---

## 4. Payment Collection & Verification

---

### Record Payment via Dashboard

#### Quick Status Toggle (Click status badge):
- **PAID/VALID → PENDING**: Confirm dialog → Updates Sheets + MongoDB
- **PENDING/ACTIVE → PAID**: Opens Record Payment panel

#### Record Payment Panel (Slide-in):
| Field | Options |
|-------|---------|
| Amount (₹) | Pre-filled with Rent + EB total |
| Payment Mode | Cash / UPI / Razorpay / Bank Transfer |

**On Confirm:**
1. `/api/mark-paid` → Status → VALID in Sheets + MongoDB
2. 📄 Invoice PDF generated
3. 📱 WhatsApp receipt sent to tenant
4. 📱 Admin notified: "💰 Money In"
5. 🔔 In-app + push notification

#### Via Edit Modal:
Change Payment Status dropdown to PAID + select mode → Save → Same flow as above

---

### Verify Payments via WhatsApp

#### Verify UPI Payment:
```
VERIFY UPI 919876543210
→ Status → VALID
→ Invoice PDF → WhatsApp receipt to tenant
→ In-app + push notification
```

#### Verify Cash Payment:
```
VERIFY CASH 919876543210
→ Same flow as UPI verification
```

#### Reject Payment:
```
REJECT 919876543210
→ Status → ACTIVE
→ Tenant notified: "Payment rejected"
```

#### Mark Cash Directly:
```
MARK CASH 919876543210
→ Directly marks as paid + generates receipt
```

---

## 5. Dashboard — Monitoring & Analytics

> URL: `https://your-domain.com/admin`

---

### Dashboard Tab

| Component | Details |
|-----------|---------|
| **Stat Cards (5)** | Residents count, Collection ₹, Pending verification, Unpaid count, Vacant beds |
| **Recent Activity Table** | Last 8 tenants (searchable) with Name, Room, Rent/EB, Status |
| **Payment Status Pie Chart** | Paid vs Pending donut chart with legend |
| **Collection Rate** | Percentage progress bar (e.g. 80%) |
| **Search** | Live search across name, room, phone, status |

### WhatsApp Dashboard:
```
DASHBOARD
→ 📊 StayFlow Dashboard
→ 👥 Total: 20 | ✅ Paid: 16 | ⏳ Pending: 4
→ 💰 Collection: ₹1,19,714
```

---

## 6. Communication — Messages & Announcements

---

### Individual Message (Dashboard)
Members Tab → ✈ Send → Type message → Sends via WhatsApp

### Bulk Announcement

#### Via WhatsApp:
```
ANNOUNCE
Bot: "What is the announcement?"
Admin: "Water supply cut tomorrow 9AM-12PM"
Bot: ✅ Sent to 20 tenants
```

#### Via Dashboard:
Auto-Tools Tab → Smart Announcements → Type message + optional media → "Send WhatsApp Announcement"

---

## 7. Vacating — Room Release

---

### Tenant-Initiated Vacate:
1. Tenant sends `VACATE` / `LEAVE` or selects 🚪 Vacate from menu
2. 📱 Admin receives: "🚪 VACATE REQUEST — Rahul, Room 103, Phone: 91xxxxx"
3. Admin clears dues and processes

### Admin Processes Vacate:

#### Via WhatsApp:
```
VACATE 103
→ Status → VACATED in Sheets + MongoDB
→ Room freed in occupancy count
→ Location occupancy updated
```

#### Via Dashboard:
Members Tab → Click 🗑️ Delete on tenant → Confirm → Removed

---

## 8. App Settings

**Dashboard** → App Settings Tab

| Section | Settings |
|---------|----------|
| **Business** | Business Name, UPI ID |
| **Billing** | Rent Due Date, EB Due Date, EB Unit Rate |
| **Contacts** | Owner Phone |
| **Integrations** | Google Sheet ID, Razorpay Key, WhatsApp Phone ID |

---

## 9. API Endpoints Reference

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/tenants` | GET | API Key | List all tenants |
| `/api/add-tenant` | POST | API Key | Add new tenant |
| `/api/update-and-notify` | POST | API Key | Update tenant info + status |
| `/api/mark-paid` | POST | API Key | Record payment (full flow) |
| `/api/delete-tenant` | POST | API Key | Remove tenant |
| `/api/notify-tenant` | POST | API Key | Send bill to individual |
| `/api/notify-all` | POST | API Key | Send bills to all unpaid |
| `/api/announcement` | POST | API Key | Message to one or all tenants |
| `/api/upload-aadhaar` | POST | API Key | Upload Aadhaar image |
| `/api/generate-invoice` | POST | API Key | Generate invoice PDF |
| `/api/eb-calculate` | POST | API Key | Calculate & split EB bills |
| `/api/web-register` | POST | Public | Web registration form |
| `/api/public/register` | POST | Public | AJAX registration |
| `/api/queries` | POST | Public | Submit tenant query |

---

## Complete Admin Lifecycle Diagram

```
1. ONBOARDING (New Tenant)
   ├── Dashboard: + New Resident → Name, Phone, Room, Rent
   ├── Web Form: Tenant fills register.html → auto-added
   ├── WhatsApp: Tenant sends JOIN → bot guides step-by-step
   ├── Result: Sheets + MongoDB + WhatsApp confirmation + PDF
   └── Admin gets: WhatsApp notification + Dashboard notification

2. EXISTING TENANT MANAGEMENT
   ├── View: Members table (search, filter by location)
   ├── Edit: Modal with all fields + payment status
   ├── Message: Send custom WhatsApp to individual
   ├── Bill: Send personalized invoice to individual
   └── Delete: Remove from Sheets + MongoDB

3. MONTHLY BILLING
   ├── Set EB: SET EB 103 150 (or Dashboard EB Tool)
   ├── Send Bills: SEND BILL (or Dashboard Notify All)
   └── Each tenant gets: Invoice PDF + Razorpay link

4. PAYMENT COLLECTION
   ├── Online (Razorpay): Auto-verified → Receipt sent
   ├── Cash: Tenant reports → Admin: VERIFY CASH xxxxx
   ├── Dashboard: Click status badge or Record Payment panel
   └── All paths: Sheets + MongoDB + WhatsApp + PDF + Push

5. MONITORING
   ├── Dashboard: Stats, pie chart, collection rate, search
   ├── WhatsApp: DASHBOARD, PAID LIST, PENDING LIST
   └── Notifications: In-app + push for all events

6. COMMUNICATION
   ├── Individual: Dashboard Send button → custom WhatsApp
   ├── Bulk: ANNOUNCE or Dashboard Smart Announcements
   └── Reminders: SEND REMINDER to unpaid tenants

7. VACATING
   ├── Tenant requests via WhatsApp → Admin notified
   ├── Admin: VACATE 103 (or Dashboard delete)
   ├── Status → VACATED, room freed
   └── Location occupancy updated
```
