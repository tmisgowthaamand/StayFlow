# 🔧 Expo "Something Went Wrong" - Complete Fix Guide

## 🎯 Current Situation

**Problem:** Expo Go shows "Something went wrong" error
**Status:** Same WiFi network ✅ | Metro Bundler running ✅ | App not connecting ❌

---

## 🧪 Test Results

I've created a **minimal test app** (`App.test.js`) to isolate the issue.

### If Test App Works:
✅ **Network is fine** - The issue is in your original `App.js` code

### If Test App Also Fails:
❌ **Connection issue** - Follow the network fixes below

---

## 🔴 Most Likely Causes (In Order)

### 1. **JavaScript Error in App.js** (80% probability)
Your original App.js has complex dependencies that might be failing:
- Navigation setup
- AsyncStorage
- Notifications
- Context providers
- Theme providers

**Solution:** Check for missing dependencies or initialization errors

### 2. **Network/Firewall Issue** (15% probability)
Even on same WiFi, firewall might block

**Solution:** Allow Node.js through Windows Firewall

### 3. **Expo Go Version Mismatch** (5% probability)
Old Expo Go app incompatible with SDK 54

**Solution:** Update Expo Go from Play Store

---

## ✅ Solution 1: Fix Original App.js

### Step 1: Restore Original App
```bash
cd mobile
mv App.js App.test.js
mv App.backup.js App.js
```

### Step 2: Check for Missing Dependencies
```bash
cd mobile
npm install
```

### Step 3: Look for Initialization Errors

Common issues in your App.js:
- **AsyncStorage** not initialized properly
- **Notifications** permissions failing
- **Navigation** setup error
- **Context providers** wrapping incorrectly

### Step 4: Add Error Boundary

Add this to your App.js:

```javascript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ App Error</Text>
          <Text style={styles.errorDetail}>{this.state.error?.toString()}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617',
    padding: 20,
  },
  errorText: {
    fontSize: 24,
    color: '#EF4444',
    marginBottom: 10,
  },
  errorDetail: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
});

// Wrap your App export
export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
```

---

## ✅ Solution 2: Simplify App.js Temporarily

Create a minimal version to test each feature:

```javascript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.text}>✅ StayFlow Mobile</Text>
      <Text style={styles.subtext}>Basic app is working!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7C3AED',
    marginBottom: 10,
  },
  subtext: {
    fontSize: 16,
    color: '#94A3B8',
  },
});
```

Then gradually add back features:
1. ✅ Basic UI → Test
2. ✅ Add Navigation → Test
3. ✅ Add AsyncStorage → Test
4. ✅ Add Notifications → Test
5. ✅ Add Context Providers → Test

---

## ✅ Solution 3: Check Dependencies

### Verify all packages are installed:
```bash
cd mobile
npm install
```

### Check for peer dependency warnings:
```bash
npm list
```

### Reinstall if needed:
```bash
cd mobile
rm -rf node_modules
rm package-lock.json
npm install
```

---

## ✅ Solution 4: Windows Firewall Fix

### Allow Node.js through firewall:

1. Open **Windows Defender Firewall**
2. Click **"Allow an app or feature through Windows Defender Firewall"**
3. Click **"Change settings"** (requires admin)
4. Click **"Allow another app..."**
5. Browse to: `C:\Program Files\nodejs\node.exe`
6. Add it
7. Check **both Private and Public** networks
8. Click **OK**

### Or use PowerShell (Run as Administrator):
```powershell
New-NetFirewallRule -DisplayName "Node.js" -Direction Inbound -Program "C:\Program Files\nodejs\node.exe" -Action Allow
```

---

## ✅ Solution 5: Use Tunnel Mode

Tunnel mode bypasses local network issues:

```bash
cd mobile
npx expo start --tunnel
```

This will:
- Install `@expo/ngrok` (say Yes)
- Create a public URL like `exp://abc123.ngrok.io`
- Work even on different networks

---

## ✅ Solution 6: Check Expo Go Version

### Update Expo Go:
1. Open Play Store (Android) or App Store (iOS)
2. Search "Expo Go"
3. Update to latest version
4. Restart phone
5. Try again

### Check SDK compatibility:
Your app uses **Expo SDK 54**
Expo Go must be version **2.31.0 or higher**

---

## ✅ Solution 7: Use Android Emulator

If phone keeps failing, use emulator:

### Setup:
1. Install **Android Studio**
2. Open **AVD Manager**
3. Create a new **Virtual Device**
4. Start the emulator
5. In Expo terminal, press **`a`**

---

## ✅ Solution 8: Check Metro Bundler Logs

When you scan QR, watch terminal for errors:

### Common errors:

#### "Unable to resolve module"
```bash
cd mobile
npm install
npx expo start --clear
```

#### "Transform error"
```bash
cd mobile
rm -rf node_modules .expo
npm install
npx expo start --clear
```

#### "Network request failed"
- Check firewall
- Try tunnel mode
- Verify same WiFi

---

## 🔍 Debugging Steps

### 1. Check if app is trying to connect:
Watch terminal when you scan QR. You should see:
```
› Opening exp://192.168.1.17:8081 on [Your Phone Name]
```

If you don't see this, the QR scan isn't working.

### 2. Test network connectivity:
On your phone browser, go to:
```
http://192.168.1.17:8081
```

You should see Metro Bundler page. If not, it's a network issue.

### 3. Check Expo Go logs:
In Expo Go app, tap **"View error log"** to see detailed error.

### 4. Enable Remote Debugging:
In Expo Go, shake phone → Enable **"Remote JS Debugging"**
Then check Chrome DevTools for errors.

---

## 🎯 Step-by-Step Fix Process

### Phase 1: Test with Minimal App (Already Done)
```bash
# Test app is now active
# Scan QR code and see if it works
```

### Phase 2: If Test App Works
```bash
# Issue is in original App.js
cd mobile
mv App.js App.test.js
mv App.backup.js App.js

# Add error boundary to App.js
# Check console for errors
```

### Phase 3: If Test App Also Fails
```bash
# Network/connection issue
# Try tunnel mode
cd mobile
npx expo start --tunnel
```

### Phase 4: Nuclear Option
```bash
# Complete reset
cd mobile
rm -rf node_modules .expo
npm install
npx expo start --clear --tunnel
```

---

## 📊 Diagnostic Checklist

Run through this checklist:

- [ ] Same WiFi network? (Check phone WiFi settings)
- [ ] Firewall allows Node.js? (Check Windows Firewall)
- [ ] Expo Go updated? (Check Play Store)
- [ ] Metro Bundler running? (Check terminal)
- [ ] Test app works? (Scan QR with test app)
- [ ] Can access http://192.168.1.17:8081 from phone browser?
- [ ] No VPN active on either device?
- [ ] Port 8081 not blocked?

---

## 🚀 Quick Commands Reference

### Restart with cleared cache:
```bash
cd mobile
npx expo start --clear
```

### Use tunnel mode:
```bash
cd mobile
npx expo start --tunnel
```

### Reinstall dependencies:
```bash
cd mobile
rm -rf node_modules
npm install
```

### Switch to test app:
```bash
cd mobile
mv App.js App.backup.js
mv App.test.js App.js
```

### Restore original app:
```bash
cd mobile
mv App.js App.test.js
mv App.backup.js App.js
```

---

## 📱 What to Try Next

### Right Now:
1. **Scan QR code** with the test app active
2. **Report back** if it works or still fails

### If Test App Works:
- Issue is in original App.js
- We'll add error boundary
- Debug step by step

### If Test App Fails:
- Try tunnel mode: `npx expo start --tunnel`
- Check firewall settings
- Try Android emulator

---

## 🆘 Still Not Working?

### Get detailed logs:
```bash
cd mobile
npx expo start --clear --verbose
```

### Check React Native logs:
```bash
npx react-native log-android
# or
npx react-native log-ios
```

### Enable debug mode:
In Expo Go, shake phone → **"Enable Remote JS Debugging"**

---

## 📞 Next Steps

**Please try the test app now and let me know:**
1. ✅ Does the test app work?
2. ❌ Or does it also show "Something went wrong"?

Based on your answer, I'll provide the exact fix!
