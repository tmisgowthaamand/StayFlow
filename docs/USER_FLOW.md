# StayFlow — User (Tenant) Flow

> End-to-end WhatsApp journey from onboarding to vacating

---

## 1. First Contact — Welcome Menu

**Trigger:** User sends `HI` / `HELLO` / `HEY` / `NAMASTE`

### If NOT Registered:
```
Hello! 👋 Welcome to StayFlow.
→ Shows interactive list menu with options
```

### If Already Registered:
```
Welcome back, *Rahul*! 👋
🚪 Room: 101
✅ Status: PAID
💰 Rent: ₹7000 | EB: ₹430
💵 Total: ₹7430
→ Shows interactive list menu with options
```

### Menu Options (List Message):
| Section | Option | Description |
|---------|--------|-------------|
| 🏠 Services | 📝 New Register | Register as a new tenant |
| 🏠 Services | 🚪 Vacate | Request to vacate (only if registered) |
| 🏠 Services | 🏠 Rent | View rent details & bill |
| 🏠 Services | 💳 Pay Bills | Pay via Razorpay or Cash |
| 🏠 Services | ⚡ EB Bill | View electricity bill |
| 🏠 Services | 📜 Statements | Monthly payment statements |
| 🏠 Services | ❓ Queries | Submit a query or complaint |
| ℹ️ Information | 🎉 Holiday List | View upcoming holidays |
| ℹ️ Information | 📋 Rules | PG house rules |
| ℹ️ Information | 🛏️ Vacancy Rooms | Check available rooms |
| ℹ️ Information | 👥 Refer a Friend | Refer someone & earn rewards |

---

## 2. Registration (Onboarding)

### Path A — Web Registration Form
**Trigger:** User taps `📝 New Register` from menu → Gets a CTA button link

```
📝 New Registration
Join StayFlow by filling out the registration form.
→ [📝 Register Now] → Opens web form (register.html)
```

**Web Form Fields:**
- Name, Phone, Location, Sharing Type, Room, Rent, Advance, Aadhaar Upload

**After Submit:**
1. ✅ Added to Google Sheets → Auto-synced to MongoDB
2. 📄 Registration PDF generated
3. 📱 WhatsApp confirmation + PDF sent to user
4. 📱 Admin notified with registration copy
5. 🔔 In-app notification created

### Path B — WhatsApp Bot Onboarding (Step-by-step)
**Trigger:** User sends `JOIN`

| Step | Bot Asks | User Replies | Validation |
|------|----------|--------------|------------|
| 1 | Welcome banner + form link | — | — |
| 2 | `Your Full Name` | `Rahul Deshmukh` | AI validates real name |
| 3 | `Confirm Phone Number` | `9940089442` | AI validates phone |
| 4 | `Room Number` | `103` | AI validates room ID |
| 5 | `Sharing Type (1/2/3/4)` | `3` | Maps to rent: 1→₹9000, 2→₹7000, 3→₹6500, 4→₹6500 |
| 6 | `Advance Paid` | `5000` | AI validates amount |
| 7 | `Upload Aadhaar image` | *sends photo* | Checks image exists |

**After Complete:**
1. ✅ Tenant added to Sheets + MongoDB
2. 📄 Registration PDF generated & sent
3. 📋 PG Rules sent automatically
4. 📱 Admin notified
5. 🔔 In-app + push notification

---

## 3. Viewing Rent / Bills

### Rent
**Trigger:** `RENT` command or `🏠 Rent` from menu

```
🧾 Invoice & Payment

Hi Rahul,
💰 Total Due: ₹7430
📅 Due Date: 5th April

📋 Breakdown:
🏠 Rent: ₹7000
⚡ EB: ₹430
━━━━━━━━━━━
💵 Total: ₹7430

💳 Pay Online (Razorpay): [link]

→ Attached: StayFlow_Invoice.pdf
→ Buttons: [💳 Pay Now UPI] [💵 Pay Cash] [❌ Cancel]
```

### EB Bill
**Trigger:** `EB` command or `⚡ EB Bill` from menu
```
⚡ Your Electricity Bill for this month is ₹430.
This is included in your total rent.
```

### Payment Status
**Trigger:** `STATUS` command
```
✅ Your current payment status is: PAID
   — or —
⏳ Your current payment status is: PENDING
```

---

## 4. Making Payment

### Option A — Online Payment (Razorpay/UPI)
**Trigger:** `PAID` or `💳 Pay Now UPI` or `💳 Pay via Razorpay`

```
💳 Pay Online (Razorpay)
🏠 Rent: ₹7000 | ⚡ EB: ₹430
💰 Total: ₹7430
→ [💳 Pay Now] → Opens Razorpay payment page
```

**After Payment (via webhook):**
1. ✅ Status updated to `PAID` in Sheets + MongoDB
2. 📄 Invoice PDF generated
3. 📱 Receipt sent via WhatsApp
4. 📱 Admin notified: "💰 Money In — Rahul, Room 103, ₹7430"
5. 🔔 In-app + push notification

### Option B — Cash Payment
**Trigger:** `CASH PAID` or `💵 Pay Cash`

| Step | Bot Asks | User Replies |
|------|----------|--------------|
| 1 | Shows total due, asks for amount paid | `7430` |
| 2 | Validates: blocks underpayment | — |
| 3 | Asks for payment date | `Today` |

**After Cash Submit:**
1. ⏳ Status set to `PENDING` (needs admin verification)
2. 📝 Payment logged in Sheets + MongoDB with `CASH-XXXXXX` reference
3. 📱 User gets: "Cash Payment Submitted — pending admin verification"
4. 📱 Admin gets: "💵 Cash Payment — Needs Verification" + `VERIFY CASH 91xxxxx` command
5. 🔔 In-app notification

**After Admin Verifies:**
1. ✅ Status updated to `VALID`
2. 📄 Invoice generated & sent
3. 📱 User notified: "Payment Confirmed!"

---

## 5. Payment History & Statements

**Trigger:** `HISTORY` or `📜 Statements` from menu

### Statements (Last 6 months with selectable months):
```
📜 Payment Statements
Select a month to view your statement:
→ List of months: April 2026, March 2026, February 2026...
```

### Individual Statement:
```
📜 Payment Statement
📅 Month: March 2026
👤 Name: Rahul
🚪 Room: 103
💵 Total: ₹7430
💳 Mode: UPI
🔖 TXN ID: UPI-8821
📅 Paid: 03/05/2026
✅ Status: VALID
```

---

## 6. Help / Complaints

**Trigger:** `HELP` or `❓ Queries` from menu

### Via WhatsApp Bot:
| Step | Bot Asks | User Replies |
|------|----------|--------------|
| 1 | Shows categories: Maintenance, Payment Issue, Profile Update, Vacate Room | `Maintenance` |
| 2 | "Please describe your issue in detail" | `Water leaking in bathroom` |

**After Submit:**
1. ✅ User gets: "Complaint Registered!"
2. 📱 Admin notified with full details (name, room, phone, issue)
3. 🔔 In-app notification: "New Issue: Maintenance"

### Via Web Form:
- Opens `queries.html` with form fields
- Submits to `/api/queries`
- Same notification flow

---

## 7. Advance Balance

**Trigger:** `ADVANCE`
```
💰 You have an advance of ₹5000 with us.
```

---

## 8. Vacancy & Referral

### Check Vacant Rooms
**Trigger:** `🛏️ Vacancy Rooms`
```
🛏️ Available Rooms
📍 Main Branch
   🛏️ Total Beds: 30
   👤 Occupied: 20
   🟢 Vacant: 10
→ [📞 Contact] to book
```

### Refer a Friend
**Trigger:** `👥 Refer a Friend`
```
Share this registration link with your friends:
→ [📤 Share Link] → registration form with referral code
```

---

## 9. Vacate Room

**Trigger:** `VACATE` / `LEAVE` / `🚪 Vacate` from menu

```
We are sorry to see you go! 😔
Your request to vacate Room 103 has been sent to the admin.
We will process it shortly.
```

**What Happens:**
1. 📱 Admin receives: "🚪 VACATE REQUEST — Rahul, Room 103, Phone: 91xxxxx"
2. Admin clears dues and processes vacate via dashboard or `VACATE 103` command
3. Status set to `VACATED` in Sheets + MongoDB

---

## 10. Smart AI Chat

**Trigger:** Any unrecognized message

- Gemini AI analyzes the message
- Maps to relevant command (rent, payment, status, etc.)
- Falls back to friendly "Type HI to see what I can do!" if no match

---

## Flow Diagram (Text)

```
User sends HI
    │
    ├── Not Registered ──→ Menu → 📝 Register → Web Form / Bot Onboarding
    │                                              │
    │                                              └→ Sheets + MongoDB + PDF + WhatsApp Confirmation
    │
    └── Registered ──→ Menu
            │
            ├── 🏠 Rent ──→ Invoice PDF + Pay Buttons
            │       ├── 💳 Razorpay ──→ Online Payment ──→ Auto-Verified ──→ Receipt
            │       └── 💵 Cash ──→ Amount → Date ──→ PENDING ──→ Admin Verifies ──→ Receipt
            │
            ├── ⚡ EB Bill ──→ Shows EB amount
            ├── 📜 Statements ──→ Month selector → Statement details
            ├── ❓ Queries ──→ Category → Description ──→ Admin notified
            ├── 🛏️ Vacancy ──→ Shows available rooms
            ├── 📋 Rules ──→ PG rules displayed
            ├── 👥 Refer ──→ Shareable registration link
            └── 🚪 Vacate ──→ Request sent to admin
```
