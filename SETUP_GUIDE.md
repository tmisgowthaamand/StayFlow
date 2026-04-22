# 🛠️ StayFlow Setup Guide: Google Sheets & WhatsApp API

This guide will help you create all the necessary credentials for your `.env` file.

---

## 📊 Part 1: Google Sheets Setup

### 1. Create your Google Sheet
1. Open [Google Sheets](https://sheets.new).
2. Name it (e.g., `StayFlow Database`).
3. **Copy the Sheet ID**: Look at the URL in your browser. It looks like this:
   `https://docs.google.com/spreadsheets/d/1abc123_YOUR_SHEET_ID_HERE/edit`
   *Copy the long code between `/d/` and `/edit`.*

### 2. Create Service Account & Private Key
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a **New Project** (if you don't have one).
3. Search for **"Google Sheets API"** in the search bar and click **Enable**.
4. Go to **APIs & Services > Credentials**.
5. Click **+ CREATE CREDENTIALS** > **Service Account**.
6. Give it a name (e.g., `stayflow-bot`) and click **Create and Continue**.
7. Skip the role part (optional) and click **Done**.
8. Click on the **Email** of the service account you just created.
9. Go to the **Keys** tab > **Add Key** > **Create New Key**.
10. Select **JSON** and click **Create**. A file will download.

### 3. Update your `.env`
Open the downloaded JSON file:
- **`GOOGLE_SERVICE_ACCOUNT_EMAIL`**: Copy the `client_email` value.
- **`GOOGLE_PRIVATE_KEY`**: Copy the `private_key` value.
  *Note: Make sure it includes the `\n` characters and is wrapped in double quotes in your `.env`.*

### 4. Share the Sheet
1. Go back to your Google Sheet.
2. Click the **Share** button.
3. Paste the **Service Account Email** (from step 3).
4. Give it **Editor** access and click **Send**.

---

## 💬 Part 2: WhatsApp Cloud API Setup

### 1. Meta Developer Portal
1. Go to [Meta for Developers](https://developers.facebook.com/).
2. Create a **Business App**.
3. Add the **WhatsApp** product to your app.
4. Go to **WhatsApp > API Setup**.
5. Copy your **Phone Number ID**.
6. **IMPORTANT**: Instead of the temporary token, generate a **Permanent Access Token** via **Meta Business Settings > System Users**. (See `fix_whatsapp_token.md` for full steps).

### 2. Generate Verify Token
A "Verify Token" is just a secret password you create so Meta can trust your server.

**I have generated a secure one for you below:**
> `STAYFLOW_SECURE_TOKEN_2026_XYZ`

### 3. Webhook Configuration
1. Go to **WhatsApp > Configuration**.
2. Click **Edit** on the Webhook section.
3. **Callback URL**: `https://your-public-url.com/webhook` (Use `ngrok` if testing locally).
4. **Verify Token**: Paste the token from above: `STAYFLOW_SECURE_TOKEN_2026_XYZ`.
5. Click **Verify and Save**.
6. Click **Manage** and subscribe to **"messages"**.

---

## 🚀 Part 3: WhatsApp Web (Free Automation Mode)

StayFlow now supports **Free WhatsApp Messaging** using your own phone (no Meta fees).

1. **Start the Server**: Run `npm run dev`.
2. **Scan the QR**: Look at your terminal/console. A QR code will appear.
3. **Link Device**: Open WhatsApp on your phone > Linked Devices > Link a Device.
4. **Scan**: Scan the QR code in the terminal.
5. **Ready!**: Once the terminal says `WhatsApp Web Client is READY!`, the bot will send all messages for free.

*Note: If you use this mode, you don't need the Meta WHATSAPP_TOKEN. It will prioritize your phone connection.*

---

## ✅ Summary of your `.env` setup:
```env
BUSINESS_NAME="Your PG Name"
OWNER_PHONE="91XXXXXXXXXX"
OWNER_UPI_ID="receiver@upi"
EB_UNIT_RATE=15
GOOGLE_SHEET_ID="your_copied_id"
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourKey..."
```
