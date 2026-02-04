# 🔗 Google Apps Script Integration Guide for StayFlow

This guide explains how to set up Google Forms to automatically trigger tenant onboarding in StayFlow.

---

## 📋 Prerequisites

1. A Google Account
2. StayFlow server running and accessible (via Ngrok or deployed URL)
3. Access to create Google Forms and Sheets

---

## 🛠️ Step 1: Create the Google Form

Create a new Google Form with the following fields:

| Question Label | Answer Type | Required |
|---------------|-------------|----------|
| Full Name | Short Answer | ✅ Yes |
| Phone Number | Short Answer | ✅ Yes |
| Room Number | Short Answer | ✅ Yes |
| Sharing Type | Dropdown (Single/Double/Triple/4-Sharing) | ✅ Yes |
| Advance Amount | Short Answer (Number) | ✅ Yes |
| Monthly Rent | Short Answer (Number) | ✅ Yes |
| Location | Dropdown (Chennai PG1/Bangalore PG2/etc.) | ✅ Yes |
| Aadhaar Card | File Upload (Images only, 5MB max) | ✅ Yes |

### Form Settings:
- ✅ Collect email addresses (optional)
- ✅ Limit to 1 response (optional for preventing duplicates)
- ✅ Link responses to a Google Sheet

---

## 🛠️ Step 2: Create Response Spreadsheet

1. In the Form, click **Responses** tab
2. Click the **Google Sheets** icon to create a linked spreadsheet
3. Name it: `StayFlow_Form_Responses`

---

## 🛠️ Step 3: Add Apps Script Trigger

1. Open the linked Google Sheet
2. Go to **Extensions → Apps Script**
3. Delete any existing code and paste the following:

```javascript
/**
 * StayFlow - Google Form Onboarding Trigger
 * This script sends form data to StayFlow server when a new response is submitted
 */

// ⚠️ IMPORTANT: Replace with your actual server URL
const STAYFLOW_WEBHOOK_URL = 'https://your-server-url.ngrok-free.app/webhook/google-form';

function onFormSubmit(e) {
  try {
    const formData = e.namedValues;
    
    // Extract Aadhaar file link (Google Drive URL)
    let aadhaarLink = '';
    if (formData['Aadhaar Card'] && formData['Aadhaar Card'][0]) {
      aadhaarLink = formData['Aadhaar Card'][0];
    }
    
    // Prepare payload
    const payload = {
      'Name': formData['Full Name'] ? formData['Full Name'][0] : '',
      'Phone': formData['Phone Number'] ? formData['Phone Number'][0] : '',
      'Room': formData['Room Number'] ? formData['Room Number'][0] : '',
      'Sharing Type': formData['Sharing Type'] ? formData['Sharing Type'][0] : '',
      'Advance': formData['Advance Amount'] ? formData['Advance Amount'][0] : '0',
      'Monthly Rent': formData['Monthly Rent'] ? formData['Monthly Rent'][0] : '0',
      'Location': formData['Location'] ? formData['Location'][0] : 'Main Branch',
      'Aadhaar Image': aadhaarLink,
      'Timestamp': new Date().toISOString()
    };
    
    Logger.log('Sending payload to StayFlow: ' + JSON.stringify(payload));
    
    // Send to StayFlow server
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(payload),
      'muteHttpExceptions': true
    };
    
    const response = UrlFetchApp.fetch(STAYFLOW_WEBHOOK_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log('Response Code: ' + responseCode);
    Logger.log('Response: ' + responseText);
    
    if (responseCode !== 200) {
      // Log error but don't throw - form submission should still succeed
      Logger.log('Warning: StayFlow webhook returned non-200 status');
    }
    
  } catch (error) {
    Logger.log('Error in onFormSubmit: ' + error.toString());
    // Don't throw - let form submission succeed even if webhook fails
  }
}

/**
 * Manual test function - use this to test the webhook
 */
function testWebhook() {
  const testPayload = {
    'Name': 'Test User',
    'Phone': '9876543210',
    'Room': '101',
    'Sharing Type': 'Double',
    'Advance': '5000',
    'Monthly Rent': '7500',
    'Location': 'Chennai PG1',
    'Aadhaar Image': 'https://drive.google.com/file/test',
    'Timestamp': new Date().toISOString()
  };
  
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(testPayload),
    'muteHttpExceptions': true
  };
  
  try {
    const response = UrlFetchApp.fetch(STAYFLOW_WEBHOOK_URL, options);
    Logger.log('Test Response: ' + response.getContentText());
  } catch (error) {
    Logger.log('Test Error: ' + error.toString());
  }
}

/**
 * Setup function - run this once to create the trigger
 */
function createFormSubmitTrigger() {
  // Delete existing triggers to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onFormSubmit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new trigger
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onFormSubmit()
    .create();
  
  Logger.log('Form submit trigger created successfully!');
}
```

---

## 🛠️ Step 4: Configure the Script

1. **Update the Webhook URL**: Replace `STAYFLOW_WEBHOOK_URL` with your actual server URL
   ```javascript
   const STAYFLOW_WEBHOOK_URL = 'https://your-actual-url.ngrok-free.app/webhook/google-form';
   ```

2. **Save the script**: Ctrl+S or Click the 💾 save icon

---

## 🛠️ Step 5: Create the Trigger

1. Run the `createFormSubmitTrigger` function:
   - Click the dropdown next to "Run" button
   - Select `createFormSubmitTrigger`
   - Click **Run**

2. **Authorize the script**:
   - Click "Review Permissions"
   - Select your Google account
   - Click "Advanced" → "Go to StayFlow (unsafe)"
   - Click "Allow"

3. **Verify trigger created**:
   - Go to **Triggers** (clock icon on left sidebar)
   - You should see: `onFormSubmit | From spreadsheet | On form submit`

---

## 🛠️ Step 6: Test the Integration

### Method 1: Use Test Function
1. Run `testWebhook` function
2. Check Apps Script logs (**View → Logs**)
3. Check StayFlow server logs for incoming webhook

### Method 2: Submit Real Form
1. Open the Google Form
2. Fill in test data
3. Submit
4. Check:
   - Spreadsheet for new row
   - Apps Script logs for webhook call
   - StayFlow server for new tenant

---

## 📊 Aadhaar Upload Flow

The form collects Aadhaar as a file upload. Here's what happens:

1. **User uploads** → File stored in Google Drive (owned by form creator)
2. **File link** → Stored in response sheet as Drive URL
3. **Webhook sends** → Link to StayFlow
4. **StayFlow stores** → Link in Tenants sheet

### Making Aadhaar Files Accessible

If you need to download/view uploads programmatically:

1. Create a shared Drive folder for uploads
2. Set form file destination to this folder
3. Share folder with service account email (from `service-account.json`)

---

## 🔧 Troubleshooting

### Webhook Not Triggering?
- Check trigger exists in **Triggers** section
- Verify URL is correct and server is running
- Check Apps Script **Execution Log** for errors

### 403 Forbidden Error?
- Your ngrok URL might have changed
- Update the `STAYFLOW_WEBHOOK_URL` constant

### Timeout Errors?
- StayFlow server might be slow to respond
- Check server logs for processing issues

### Missing Data?
- Verify field names match between Form and Script
- Check `namedValues` structure in logs

---

## 📱 Expected Behavior After Setup

When a new tenant fills the Google Form:

1. ✅ Data saved to Google Sheet
2. ✅ Webhook sent to StayFlow server
3. ✅ New row added to Tenants sheet
4. ✅ Welcome WhatsApp message sent to tenant
5. ✅ Notification sent to owner
6. ✅ Tenant can type "HI" to see their dashboard

---

## 🔒 Security Notes

- Keep service account credentials private
- Don't share the webhook URL publicly
- Regularly rotate ngrok URLs if using free tier
- Consider IP whitelisting for production

---

## 📞 Support

For issues with this integration:
1. Check server logs: `bot.log` and `debug.log`
2. Check Apps Script logs
3. Test webhook manually using `testWebhook()` function
