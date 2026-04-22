# 🔧 Expo Connection Troubleshooting Guide

## ❌ Problem: "Something went wrong" Error in Expo Go

When you see this error after scanning the QR code or entering the URL, it means the app failed to load. Here are the solutions:

---

## ✅ Solution 1: Check Network Connection

### Both devices must be on the SAME WiFi network:
- **Your Computer**: Connected to WiFi `192.168.1.x`
- **Your Phone**: Must be on the SAME WiFi network

### Steps:
1. Open WiFi settings on your phone
2. Verify you're connected to the same network as your PC
3. If using mobile data, switch to WiFi
4. If using different WiFi (like guest network), switch to main network

---

## ✅ Solution 2: Use LAN Connection Instead

The current URL `exp://192.168.1.17:8081` is a LAN address. Try this:

### In Expo Go App:
1. Open Expo Go
2. Tap "Enter URL manually"
3. Type: `exp://192.168.1.17:8081`
4. Press "Connect"

### Alternative - Use Tunnel Mode:
```bash
cd mobile
npx expo start --tunnel
```
This creates a public URL that works even on different networks.

---

## ✅ Solution 3: Clear Expo Cache

### On Your Computer:
```bash
cd mobile
npx expo start --clear
```

### On Your Phone:
1. Open Expo Go app
2. Go to Settings (profile icon)
3. Clear cache
4. Force close and reopen Expo Go
5. Try scanning QR again

---

## ✅ Solution 4: Check Firewall Settings

Windows Firewall might be blocking the connection.

### Steps:
1. Open **Windows Defender Firewall**
2. Click **"Allow an app through firewall"**
3. Find **Node.js** or **Expo**
4. Check both **Private** and **Public** networks
5. Click **OK**
6. Restart Expo server

---

## ✅ Solution 5: Restart Everything

### Full Reset:
1. **Stop Expo server** (Ctrl+C in terminal)
2. **Close Expo Go** on phone (force close)
3. **Restart WiFi** on both devices
4. **Start Expo again**:
   ```bash
   cd mobile
   npm start
   ```
5. **Reopen Expo Go** and scan QR

---

## ✅ Solution 6: Check App Configuration

### Verify package.json:
```json
{
  "main": "index.js",
  "scripts": {
    "start": "expo start --port 8081"
  }
}
```

### Verify index.js exists:
```javascript
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import App from './App';
registerRootComponent(App);
```

---

## ✅ Solution 7: Use Development Build

If Expo Go keeps failing, try development build:

```bash
cd mobile
npx expo start --dev-client
```

Then press `s` in terminal to switch to development build.

---

## ✅ Solution 8: Check for Port Conflicts

Port 8081 might be in use:

### Check what's using port 8081:
```bash
netstat -ano | findstr :8081
```

### Kill the process:
```bash
taskkill /PID <process_id> /F
```

### Or use a different port:
```bash
npx expo start --port 8082
```

---

## ✅ Solution 9: Update Expo Go App

### On Your Phone:
1. Open Play Store (Android) or App Store (iOS)
2. Search for "Expo Go"
3. Update to latest version
4. Restart phone
5. Try again

---

## ✅ Solution 10: Check Metro Bundler Logs

When you scan the QR code, watch the terminal for errors:

### Common Errors:

#### Error: "Unable to resolve module"
```bash
cd mobile
npm install
npx expo start --clear
```

#### Error: "Port already in use"
```bash
npx expo start --port 8082
```

#### Error: "Network request failed"
- Check firewall
- Verify same WiFi network
- Try tunnel mode

---

## 🔍 Debugging Steps

### 1. Check if Metro Bundler is running:
Look for this in terminal:
```
› Metro waiting on exp://192.168.1.17:8081
```

### 2. Test connection from phone browser:
Open browser on phone and go to:
```
http://192.168.1.17:8081
```
If it loads, network is fine. If not, it's a network issue.

### 3. Check Expo Go logs:
In Expo Go app, tap "View error log" to see detailed error.

---

## 🚀 Quick Fix Commands

### Clear everything and restart:
```bash
cd mobile
rm -rf node_modules
npm install
npx expo start --clear
```

### Use tunnel (works across networks):
```bash
cd mobile
npx expo start --tunnel
```

### Use localhost (if phone and PC are same device):
```bash
cd mobile
npx expo start --localhost
```

---

## 📱 Alternative: Use Android Emulator

If phone connection keeps failing, use emulator:

### 1. Install Android Studio
### 2. Create AVD (Android Virtual Device)
### 3. Start emulator
### 4. In Expo terminal, press `a`

---

## 🌐 Network Configuration

### Find your PC's IP address:
```bash
ipconfig
```
Look for "IPv4 Address" under your WiFi adapter.

### Verify phone can reach PC:
On phone, open browser and go to:
```
http://192.168.1.17:8081
```

If you see Metro Bundler page, connection works!

---

## ⚠️ Common Mistakes

1. ❌ **Phone on mobile data** → ✅ Switch to WiFi
2. ❌ **Different WiFi networks** → ✅ Use same network
3. ❌ **VPN enabled** → ✅ Disable VPN on both devices
4. ❌ **Firewall blocking** → ✅ Allow Node.js through firewall
5. ❌ **Old Expo Go version** → ✅ Update app
6. ❌ **Cache issues** → ✅ Clear cache with `--clear`

---

## 🎯 Recommended Solution Order

Try these in order:

1. ✅ Verify same WiFi network
2. ✅ Clear Expo cache: `npx expo start --clear`
3. ✅ Restart Expo Go app (force close)
4. ✅ Check firewall settings
5. ✅ Try tunnel mode: `npx expo start --tunnel`
6. ✅ Update Expo Go app
7. ✅ Use Android emulator instead

---

## 📞 Still Not Working?

### Check these:
- [ ] Both devices on same WiFi?
- [ ] Firewall allows Node.js?
- [ ] Expo Go app updated?
- [ ] Metro Bundler running?
- [ ] No VPN active?
- [ ] Port 8081 not blocked?

### Get detailed logs:
```bash
cd mobile
npx expo start --clear --verbose
```

---

## 🔗 Useful Links

- [Expo Troubleshooting Docs](https://docs.expo.dev/troubleshooting/overview/)
- [Expo Go App](https://expo.dev/client)
- [Metro Bundler Docs](https://facebook.github.io/metro/)

---

**Current Status:**
- ✅ Expo server running on: `exp://192.168.1.17:8081`
- ✅ Metro Bundler: Active
- ❌ Phone connection: Failed ("Something went wrong")

**Next Step:** Try Solution 1 (verify same WiFi) or Solution 5 (tunnel mode)
