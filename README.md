# 🏠 StayFlow - PG Hostel Management System

A comprehensive, **100% free** automated PG (Paying Guest) hostel management system with WhatsApp automation, Google Sheets database, and a beautiful admin dashboard.

![StayFlow Banner](assets/START%20BANNER.png)

---

## 🌟 Features

### 📱 WhatsApp Bot (Free via whatsapp-web.js)
- **Tenant Portal**: Type "HI" to see dashboard with bills, payment history, and status
- **Smart Commands**: RENT, HISTORY, STATUS, VACATE, HELP, PAID
- **Payment Tracking**: UPI and Cash payment recording with receipts
- **AI-Powered**: Natural language understanding via Groq AI
- **Automated Reminders**: Bills on 1st, reminders on 3rd and 5th

### 🖥️ Admin Dashboard (React + Vite)
- **Multi-Location Support**: Manage multiple PG branches
- **Visual Room Map**: See bed occupancy (Green=Occupied, White=Vacant)
- **Real-Time Stats**: Revenue, occupancy, pending payments
- **Bulk Notifications**: Send reminders to all tenants
- **EB Bill Management**: Calculate and split electricity bills

### 📊 Google Sheets Database
- **Tenants Sheet**: Core tenant data with all details
- **Payments Sheet**: Monthly payment records
- **Locations Sheet**: Multi-branch configuration
- **EB_Bills Sheet**: Monthly electricity tracking
- **History Sheet**: Complete payment history
- **Notifications_Log**: Message tracking

### 🔄 Automation
- **Onboarding**: Google Form → Sheet → WhatsApp welcome
- **Monthly Billing**: Auto-generate bills with rent + EB
- **PDF Invoices**: Professional invoices sent via WhatsApp
- **Vacancy Management**: Tenant requests → Owner approval

---

## 🛠️ Tech Stack

| Component | Technology | Cost |
|-----------|-----------|------|
| Database | Google Sheets | ✅ Free |
| WhatsApp Bot | whatsapp-web.js | ✅ Free (no API fees) |
| Backend | Node.js + Express | ✅ Free |
| Admin Dashboard | React + Vite | ✅ Free |
| PDF Generation | jsPDF | ✅ Free |
| AI | Groq (Llama 3) | ✅ Free Tier |
| File Storage | Google Drive | ✅ Free |
| Hosting | Local/Render.com | ✅ Free Tier |

**Total Cost: ₹0 per month** 🎉

---

## 📦 Quick Start

### Prerequisites
- Node.js 18+ installed
- Google Account with Sheets API enabled
- WhatsApp on your phone (for scanning QR)

### 1. Clone & Install

```bash
git clone <your-repo>
cd StayFlow
npm install
cd dashboard && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

Required settings:
- `GOOGLE_SHEET_ID` - Create a new Google Sheet and copy the ID from URL
- `OWNER_PHONE` - Your WhatsApp number (with country code, e.g., 919876543210)
- `OWNER_UPI_ID` - Your UPI ID for payments

### 3. Setup Google Sheets

1. Create a Google Cloud Project
2. Enable Google Sheets API
3. Create Service Account and download JSON key
4. Save as `service-account.json` in project root
5. Share your Google Sheet with the service account email

### 4. Run the System

```bash
npm run dev
```

This starts:
- Backend server on `http://localhost:3000`
- Dashboard on `http://localhost:5173`

### 5. Scan WhatsApp QR

Look at the terminal for a QR code. Scan it with WhatsApp to authenticate.

---

## 📋 Bot Commands

### For Tenants

| Command | Description |
|---------|-------------|
| `HI` / `HELLO` | Show dashboard with bills & history |
| `RENT` | View current bill and pay options |
| `HISTORY` | View last 6 months payment history |
| `STATUS` | Check payment status and room details |
| `EB` | View electricity bill details |
| `PAID [TRX_ID]` | Report UPI payment |
| `PAID CASH [AMOUNT]` | Report cash payment |
| `VACATE` | Request to leave the PG |
| `HELP` | Raise a complaint |
| `JOIN` | Register as new tenant |

### For Owner

| Command | Description |
|---------|-------------|
| `DASHBOARD` | Quick stats overview |
| `TOTAL TENANTS` | Count of all tenants |
| `PAID LIST` | List of paid tenants |
| `PENDING LIST` | List of pending payments |
| `SET EB [ROOM] [UNITS]` | Calculate EB for room |
| `VACATE [ROOM]` | Force vacate a room |
| `MARK CASH [PHONE]` | Mark tenant as paid |
| `SEND BILL` | Send bills to all tenants |
| `SEND REMINDER` | Send reminders to unpaid |
| `ANNOUNCE` | Send announcement to all |

---

## 🏗️ Sheet Structure

When you run the app for the first time, it automatically creates these sheets:

### Tenants
| Column | Description |
|--------|-------------|
| Name | Full name |
| Phone | WhatsApp number |
| Room | Room number (e.g., 101) |
| Bed | Bed identifier |
| Floor | Floor number |
| Location | PG branch name |
| Sharing Type | Single/Double/Triple/4-Sharing |
| Advance | Advance amount paid |
| Aadhaar Image | Link/ID of Aadhaar upload |
| Monthly Rent | Fixed rent amount |
| EB Amount | Calculated EB share |
| Total Amount | Rent + EB |
| Status | ACTIVE/PAID/PENDING/VACATED |
| Join Date | Registration date |
| Paid Date | Last payment date |

### Locations
| Column | Description |
|--------|-------------|
| Location Name | Branch identifier |
| Address | Physical address |
| Total Rooms | Number of rooms |
| Floors | Number of floors |
| Total Beds | Capacity |
| Occupied Beds | Current occupancy |

### EB_Bills
| Column | Description |
|--------|-------------|
| Month-Year | Billing month |
| Location | PG branch |
| Total Units | Meter reading |
| Rate Per Unit | ₹/unit |
| Calculated Total EB | Total bill |

### Payments
| Column | Description |
|--------|-------------|
| Phone | Tenant phone |
| Month-Year | Payment month |
| Total Amount | Amount paid |
| Payment Mode | UPI/CASH |
| Transaction ID | Reference |
| Status | PAID/PENDING |

---

## 🔗 API Endpoints

### Tenants
- `GET /api/tenants` - List all tenants
- `POST /api/add-tenant` - Add new tenant
- `POST /api/update-bill` - Update tenant bill
- `POST /api/delete-tenant` - Remove tenant
- `POST /api/mark-paid` - Record payment

### Locations
- `GET /api/locations` - List all branches
- `POST /api/locations` - Add new branch
- `GET /api/tenants-by-location?location=X` - Filter tenants

### EB Bills
- `GET /api/eb-bills?location=X` - Get EB history
- `POST /api/eb-bills` - Add EB and auto-split

### Dashboard
- `GET /api/dashboard-stats` - Analytics data
- `GET /api/room-map?location=X` - Room occupancy

### Notifications
- `POST /api/notify-tenant` - Send bill to tenant
- `POST /api/trigger-notifications` - Notify all
- `POST /api/broadcast` - Send announcement

---

## 📂 Project Structure

```
StayFlow/
├── src/
│   ├── index.js        # Express server & API routes
│   ├── bot.js          # WhatsApp bot logic & commands
│   ├── sheets.js       # Google Sheets service
│   ├── wweb.js         # whatsapp-web.js client
│   ├── pdfService.js   # Invoice generation
│   ├── cron.js         # Scheduled reminders
│   ├── config.js       # Environment config
│   └── public/         # Static files
│       ├── register.html   # Tenant registration form
│       └── rules.html      # PG house rules page
├── dashboard/
│   └── src/
│       ├── App.jsx     # React dashboard
│       └── App.css     # Dashboard styles
├── uploads/            # PDF invoices & Aadhaar
├── assets/             # Bot banners & images
├── .env               # Configuration
├── service-account.json # Google credentials
└── package.json
```

---

## 🔧 Google Form Integration

To connect a Google Form for tenant registration:

1. Create form with fields: Name, Phone, Room, Sharing Type, Advance, Aadhaar (file upload)
2. Link to Google Sheet
3. Add Apps Script trigger (see `GOOGLE_APPS_SCRIPT_SETUP.md`)
4. Point webhook to `/webhook/google-form`

---

## 🚀 Deployment

### Local (Development)
```bash
npm run dev
# Use ngrok for WhatsApp webhook
npx ngrok http 3000
```

### Render.com (Free Hosting)
1. Push to GitHub
2. Create Web Service on Render
3. Set environment variables
4. Deploy!

Note: whatsapp-web.js requires session persistence. Use disk storage on Render.

---

## 🔒 Security Notes

- Keep `service-account.json` private
- Don't commit `.env` to git
- Rotate ngrok URLs regularly
- WhatsApp session stored in `.wwebjs_auth/`

---

## 🆘 Troubleshooting

### QR Code Not Showing?
- Check terminal output
- Try `rm -rf .wwebjs_auth` and restart

### Sheets Not Connecting?
- Verify Sheet ID in `.env`
- Check service account has Sheet access
- Verify JSON key file exists

### Messages Not Sending?
- Check WhatsApp session is active
- Verify phone format (country code required)
- Check `bot.log` for errors

---

## 📞 Support

For issues:
1. Check `bot.log` and `debug.log`
2. Verify Google Sheet permissions
3. Ensure WhatsApp is connected

---

## 📄 License

MIT License - Free to use and modify

---

Made with ❤️ for PG Owners who want automation without the cost!
