# Customize Welcome Banner & Messages

## Overview
This guide shows you how to update the welcome banner image, text messages, and menu options in StayFlow.

---

## 1. Update Welcome Banner Image

### Current Banner
- **File:** `assets/START BANNER.png`
- **Used when:** User types "HI" or "HELLO" to see the main menu
- **Recommended Size:** 1200x630 pixels (landscape)

### How to Replace

1. **Create your new banner image** with:
   - Your PG name/logo
   - Welcome message
   - Key features (Rent, EB, Payments)
   - WhatsApp icon with "Type HI to start"
   - Icons for services (rent, bills, QR code)

2. **Replace the file:**
   ```bash
   # Backup the old banner
   mv assets/START\ BANNER.png assets/START\ BANNER.png.backup
   
   # Add your new banner (must be named exactly "START BANNER.png")
   cp /path/to/your/new-banner.png assets/START\ BANNER.png
   ```

3. **Commit and deploy:**
   ```bash
   git add assets/START\ BANNER.png
   git commit -m "Update welcome banner"
   git push
   ```

---

## 2. Update Welcome Text Messages

### Location
**File:** `src/bot.js` (around line 784)

### Current Messages

**For Registered Users:**
```javascript
welcomeBody = `Welcome back, *${name}*! 👋\n\n🚪 Room: ${room}\n${statusEmoji} Status: *${status}*\n\n💰 *Current Bill:*\n🏠 Rent: ₹${rent} | ⚡ EB: ₹${eb}\n💵 *Total: ₹${total}*\n\nPlease select an option below 👇`;
```

**For New Users:**
```javascript
welcomeBody = `Hello! 👋 Welcome to *${config.businessName}*.\n\nWe're happy to have you here! Please select an option below to get started 👇`;
```

### How to Customize

Edit `src/bot.js` around line 784:

```javascript
// For registered users
welcomeBody = `Welcome back, *${name}*! 👋\n\n` +
    `🏠 Room: ${room}\n` +
    `${statusEmoji} Status: *${status}*\n\n` +
    `💰 *Your Current Bill:*\n` +
    `🏠 Rent: ₹${rent}\n` +
    `⚡ EB: ₹${eb}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `💵 *Total Due: ₹${total}*\n\n` +
    `Select an option from the menu below 👇`;

// For new users
welcomeBody = `Hello! 👋 Welcome to *${config.businessName}*.\n\n` +
    `We're excited to have you here! 🏠\n\n` +
    `Manage your rent, EB bills, and payments easily through WhatsApp.\n\n` +
    `Select an option below to get started 👇`;
```

---

## 3. Update "View Menu" Button Text

### Location
**File:** `src/bot.js` (around line 822)

### Current Code
```javascript
await sendListMessage(
    phone,
    `🏠 ${config.businessName}`,
    welcomeBody,
    '📋 View Menu',  // ← This is the button text
    sections
);
```

### How to Customize

Change the button text:

```javascript
await sendListMessage(
    phone,
    `🏠 ${config.businessName}`,
    welcomeBody,
    '📱 Open Menu',  // ← Your custom text
    sections
);
```

**Other Options:**
- `'🎯 Show Options'`
- `'📋 Main Menu'`
- `'🔍 Explore Services'`
- `'⚡ Quick Actions'`

---

## 4. Update Menu Options

### Location
**File:** `src/bot.js` (around line 790-810)

### Current Menu Structure

**Main Services Menu:**
```javascript
const mainMenuRows = [];
if (isRegistered) {
    mainMenuRows.push({ id: 'menu_vacate', title: '🚪 Vacate', description: 'Request to vacate your room' });
} else {
    mainMenuRows.push({ id: 'menu_register', title: '📝 New Register', description: 'Register as a new tenant' });
}
mainMenuRows.push(
    { id: 'menu_rent', title: '🏠 Rent', description: 'View rent details & bill' },
    { id: 'menu_pay', title: '💳 Pay Bills', description: 'Pay via Razorpay or Cash' },
    { id: 'menu_eb_bill', title: '⚡ EB Bill', description: 'View electricity bill' },
    { id: 'menu_statements', title: '📜 Statements', description: 'Monthly payment statements' },
    { id: 'menu_queries', title: '❓ Queries', description: 'Submit a query or complaint' }
);
```

**Information Menu:**
```javascript
const infoMenuRows = [
    { id: 'menu_holidays', title: '🎉 Holiday List', description: 'View upcoming holidays' },
    { id: 'menu_rules', title: '📋 Rules', description: 'PG house rules & regulations' },
    { id: 'menu_vacancy', title: '🛏️ Vacancy Rooms', description: 'Check available rooms' },
    { id: 'menu_refer', title: '👥 Refer a Friend', description: 'Refer someone & earn rewards' }
];
```

### How to Customize

**Change Icons:**
```javascript
{ id: 'menu_rent', title: '💰 Rent', description: 'View rent details & bill' },
{ id: 'menu_pay', title: '💸 Pay Now', description: 'Pay via UPI or Cash' },
```

**Change Descriptions:**
```javascript
{ id: 'menu_eb_bill', title: '⚡ EB Bill', description: 'Check your electricity charges' },
{ id: 'menu_queries', title: '❓ Help', description: 'Get help or report an issue' }
```

**Add New Menu Item:**
```javascript
mainMenuRows.push(
    { id: 'menu_maintenance', title: '🔧 Maintenance', description: 'Request maintenance service' }
);
```

Then add the handler in the switch statement:
```javascript
case 'MENU_MAINTENANCE':
    await sendMessage(phone, '🔧 *Maintenance Request*\n\nPlease describe the issue...');
    break;
```

---

## 5. Update JOIN Banner

### Current Banner
- **File:** `assets/JOIN.png`
- **Used when:** User types "JOIN" command or selects "New Register"

### How to Replace

1. **Create new JOIN banner** with:
   - "Welcome to [Your PG Name]"
   - "Manage Rent • EB • Payments on WhatsApp"
   - WhatsApp icon with "Type JOIN to start"
   - Service icons (rent, bills, QR code)

2. **Replace the file:**
   ```bash
   cp /path/to/your/new-join-banner.png assets/JOIN.png
   ```

3. **Update the caption text** in `src/bot.js` (line 841):
   ```javascript
   const regCaption = `📝 *New Registration*\n━━━━━━━━━━━━━━━━━━━━\n\n` +
       `Join *${config.businessName}* today!\n\n` +
       `✅ Easy rent payments\n` +
       `✅ EB bill tracking\n` +
       `✅ 24/7 WhatsApp support\n\n` +
       `Click the button below to register 👇`;
   ```

---

## 6. Update Other Banners

### Available Banners

All banners are in the `assets/` folder:

| Banner File | Used For | Recommended Size |
|------------|----------|------------------|
| `START BANNER.png` | Welcome menu (HI command) | 1200x630 |
| `JOIN.png` | Registration | 1200x630 |
| `Rent.png` | Rent details | 1200x630 |
| `EB Banner.png` | EB bill | 1200x630 |
| `Payment Banner.png` | Payment options | 1200x630 |
| `Rules.png` | House rules | 1200x630 |
| `Queries.png` | Query submission | 1200x630 |
| `Vacate.png` | Vacate request | 1200x630 |
| `Statements.png` | Payment statements | 1200x630 |
| `Holidays.png` | Holiday list | 1200x630 |
| `Vacancy.png` | Available rooms | 1200x630 |
| `Refer.png` | Referral program | 1200x630 |

### How to Update Any Banner

1. **Design your banner** (use Canva, Figma, or Photoshop)
2. **Export as PNG** (1200x630 pixels recommended)
3. **Replace the file:**
   ```bash
   cp /path/to/your/new-banner.png assets/[BANNER_NAME].png
   ```
4. **Commit and deploy:**
   ```bash
   git add assets/
   git commit -m "Update [banner name] banner"
   git push
   ```

---

## 7. Update Business Name

### Location
**File:** `.env` or Render Environment Variables

### Current Variable
```env
BUSINESS_NAME=StayFlow
```

### How to Change

**For Local Development:**
Edit `.env` file:
```env
BUSINESS_NAME=Your PG Name
```

**For Production (Render):**
1. Go to Render Dashboard
2. Select your service
3. Click **Environment** tab
4. Update `BUSINESS_NAME` variable
5. Save (auto-redeploys)

This will update:
- Welcome messages
- Menu headers
- All automated messages
- Registration forms

---

## 8. Complete Customization Example

Here's a complete example of customizing the welcome experience:

### Step 1: Update Welcome Text

Edit `src/bot.js` line 784:

```javascript
if (isRegistered) {
    welcomeBody = `🎉 Welcome back, *${name}*!\n\n` +
        `🏠 *Your Room:* ${room}\n` +
        `${statusEmoji} *Status:* ${status}\n\n` +
        `💰 *Current Dues:*\n` +
        `   🏠 Rent: ₹${rent}\n` +
        `   ⚡ EB: ₹${eb}\n` +
        `   ━━━━━━━━━━━━━━━\n` +
        `   💵 *Total: ₹${total}*\n\n` +
        `📱 Select an option from the menu below 👇`;
} else {
    welcomeBody = `👋 Hello! Welcome to *${config.businessName}*!\n\n` +
        `🏠 Your smart PG management system\n\n` +
        `✅ Pay rent online\n` +
        `✅ Track EB bills\n` +
        `✅ Submit queries\n` +
        `✅ 24/7 WhatsApp support\n\n` +
        `Select an option below to get started 👇`;
}
```

### Step 2: Update Menu Button

Edit `src/bot.js` line 822:

```javascript
await sendListMessage(
    phone,
    `🏠 ${config.businessName}`,
    welcomeBody,
    '🎯 Show Options',  // Changed from "View Menu"
    sections
);
```

### Step 3: Update Menu Items

Edit `src/bot.js` line 795:

```javascript
mainMenuRows.push(
    { id: 'menu_rent', title: '💰 My Rent', description: 'View your rent details' },
    { id: 'menu_pay', title: '💸 Pay Now', description: 'Pay via UPI or Cash' },
    { id: 'menu_eb_bill', title: '⚡ Electricity', description: 'View your EB bill' },
    { id: 'menu_statements', title: '📊 History', description: 'Payment history' },
    { id: 'menu_queries', title: '💬 Support', description: 'Get help or report issue' }
);
```

### Step 4: Replace Banner

```bash
# Create your custom banner (1200x630 px)
# Save as START_BANNER_NEW.png

# Replace the old banner
mv assets/START\ BANNER.png assets/START\ BANNER.png.backup
cp START_BANNER_NEW.png assets/START\ BANNER.png

# Commit changes
git add assets/START\ BANNER.png src/bot.js
git commit -m "Customize welcome banner and messages"
git push
```

---

## 9. Testing Your Changes

### Test Locally

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Send "HI" to your WhatsApp bot**

3. **Verify:**
   - Banner image appears
   - Welcome text is correct
   - Menu button text is updated
   - Menu options are correct

### Test on Production

1. **Deploy to Render** (auto-deploys on git push)

2. **Send "HI" to production bot**

3. **Verify all changes**

---

## 10. Design Tips

### Banner Design Best Practices

1. **Use high contrast** - Text should be easily readable
2. **Keep it simple** - Don't overcrowd with information
3. **Use brand colors** - Match your PG's branding
4. **Include icons** - Visual elements help understanding
5. **Test on mobile** - Most users view on phones

### Recommended Tools

- **Canva** - Easy drag-and-drop (canva.com)
- **Figma** - Professional design tool (figma.com)
- **Photoshop** - Advanced editing
- **GIMP** - Free alternative to Photoshop

### Color Schemes

**Professional:**
- Primary: #6366f1 (Indigo)
- Secondary: #10b981 (Green)
- Background: #f8fafc (Light gray)

**Warm:**
- Primary: #f59e0b (Amber)
- Secondary: #ef4444 (Red)
- Background: #fffbeb (Cream)

**Cool:**
- Primary: #3b82f6 (Blue)
- Secondary: #06b6d4 (Cyan)
- Background: #f0f9ff (Light blue)

---

## 11. Troubleshooting

### Banner Not Showing

**Cause:** File name doesn't match exactly

**Solution:**
```bash
# Check exact file name
ls -la assets/

# Ensure it's "START BANNER.png" (with space, not underscore)
mv assets/START_BANNER.png assets/START\ BANNER.png
```

### Text Not Updating

**Cause:** Changes not deployed

**Solution:**
```bash
# Commit and push changes
git add src/bot.js
git commit -m "Update welcome text"
git push

# Check Render logs to confirm deployment
```

### Menu Button Not Changing

**Cause:** Multiple places use sendListMessage

**Solution:**
Search for all occurrences:
```bash
grep -n "View Menu" src/bot.js
```

Update all instances (lines 822, 1544, etc.)

---

## Summary

To fully customize your welcome experience:

1. ✅ Replace `assets/START BANNER.png` with your design
2. ✅ Update welcome text in `src/bot.js` (line 784)
3. ✅ Change menu button text (line 822)
4. ✅ Customize menu options (line 795)
5. ✅ Update business name in `.env`
6. ✅ Test locally and on production

**Files to Edit:**
- `assets/START BANNER.png` - Welcome banner image
- `src/bot.js` - Welcome text and menu
- `.env` - Business name

**Time Required:** 30-60 minutes

**Difficulty:** Easy (no coding required for banner, basic editing for text)

---

Need help? Check the existing banners in `assets/` folder for design inspiration!
