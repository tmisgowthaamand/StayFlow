# StayFlow PG Management - System Architecture

This document outlines the complete architecture for the StayFlow PG Automation System, designed to run with minimal cost using Google Workspace and a self-hosted WhatsApp Bot.

---

## 1. System Overview

The system connects three main components:
1.  **Google Workspace (Database & Input)**: Google Forms for data entry, Google Sheets as the database.
2.  **StayFlow Server (The Brain)**: A Node.js server that manages logic, PDF generation, and connects to WhatsApp.
3.  **WhatsApp Bot (Communication)**: Handles real-time interaction with tenants and the owner.

---

## 2. Workflows

### A. Tenant Onboarding (Registration)
**Goal:** Automate tenant entry, save documents, and creating a record.

1.  **Input**: Tenant fills a **Google Form** (Link sent via WhatsApp or QR Code at gate).
    *   *Fields*: Name, Phone, Room, Sharing Type, Advance, Aadhaar Image Upload.
2.  **Process**:
    *   Google Form saves data to **Google Sheet** ("Form Responses").
    *   **Apps Script Notification**: A small script in the Sheet triggers a Webhook to the StayFlow Server (`/webhook-form`).
    *   **StayFlow Server**:
        *   Creates a new row in the "Tenants" Sheet.
        *   Downloads the Aadhaar image.
        *   Sends a **Welcome Message** to Tenant Main Menu.
        *   Sends **House Rules** (Gate timings, Payment dates, etc.).
        *   Notifies **Owner** on WhatsApp.

### B. Billing & Payment Cycle
**Goal:** Monthly Rent & EB collection with automated invoices.

1.  **Rent**: Fixed amount based on Sharing Type (e.g., 4-share = ₹6500).
2.  **Electricity Bill (EB)**:
    *   **Logic**: `(Total Unit Consumption * Rate) / Number of Tenants in Room`.
    *   **Action**: Owner sends command like `SET EB 101 100` (Room 101, 100 units).
    *   **Server**: Calculates split (e.g., ₹1500 / 4 = ₹375 each) -> Updates Sheet -> Sends WhatsApp bill to all 4 roommates.
3.  **Invoice Generation**:
    *   PDF is generated automatically using `pdfService.js`.
    *   Includes: Receipt No, Date, Tenant Details, Rent + EB breakdown, Payment Mode.
4.  **Payment Collection**:
    *   Tenant pays via UPI/Cash.
    *   Tenant replies `PAID TRX12345` or Owner marks as `Paid` in Dashboard.
    *   **Result**: Status updated to `PAID`, Receipt PDF sent to Tenant, Money Added notification to Owner.

### C. Dashboard & Administration
**Goal**: Visual management of multiple locations.

1.  **Live Map**:
    *   Shows layout of rooms (Grouped by Floor).
    *   Visual "Dots" for beds (Green=Occupied, White=Vacant).
    *   Click to Edit/View details.
2.  **Multi-Location**:
    *   Dashboard tabs for "Main Branch", "Branch 2", etc.
    *   Stats per location (Occupancy, Revenue).
3.  **Vacating**:
    *   Tenant types `VACATE` -> Owner gets request.
    *   Owner approves -> Tenant status `VACATED` -> Bed becomes free in Room Map -> Data moved to History.

---

## 3. Google Form Integration Guide (For Owner)

To connect your Google Form to StayFlow:

1.  Create a **Google Form** with questions: Name, Phone, Room, Sharing Type, Aadhaar (File Upload).
2.  Open the linked **Google Sheet**.
3.  Go to **Extensions > Apps Script**.
4.  Paste this code to trigger the onboarding automatically:

```javascript
function onFormSubmit(e) {
  var formData = e.namedValues;
  var payload = {
    name: formData['Name'][0],
    phone: formData['Phone'][0],
    room: formData['Room'][0],
    sharingType: formData['Sharing Type'][0],
    aadhaarLink: formData['Aadhaar'][0], // Google Drive Link
    advance: formData['Advance'][0]
  };

  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload)
  };

  // Replace with your actual Ngrok/Server URL
  UrlFetchApp.fetch('https://your-server-url.ngrok-free.app/webhook-form', options);
}
```
5.  Save and add a **Trigger**: `onFormSubmit` -> From spreadsheet -> On form submit.

---

## 4. WhatsApp Automation Rules (Free Cost)

We use `whatsapp-web.js` which runs a real WhatsApp Web instance on the server.
*   **No API Costs**.
*   **Media Support**: Sends PDFs, Images (QR codes).
*   **24/7 Availability**: As long as the server is running.
*   **Privacy**: Data stays on your Sheet and your Server.

---

## 5. Summary of Bot Commands

**For Tenants:**
*   `HI` / `HELLO`: Main Menu.
*   `RENT`: Check current dues.
*   `HISTORY`: View last 3 payments.
*   `VACATE`: Request to leave.
*   `HELP`: Raise a complaint.

**For Owner:**
*   `SET EB [Room] [Units]`: Calculate and send EB bills.
*   `VACATE [Room]`: Force vacate a room.
*   `MARK CASH [Phone]`: Mark a tenant as paid by cash.
*   `DASHBOARD`: Get quick stats.
*   `SEND REMINDER`: Bulk remind unpaid tenants.
