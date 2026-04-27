# Quick Reference - Build APK for StayFlow Mobile v1.1.0

## 🚀 Fastest Way to Build APK

```bash
cd mobile
eas build --platform android --profile preview
```

Wait 5-15 minutes → Download APK from link → Share with users

---

## 📋 Prerequisites Checklist

- [ ] Expo account logged in: `eas login`
- [ ] EAS CLI installed: `npm install -g eas-cli`
- [ ] In mobile directory: `cd mobile`
- [ ] Dependencies installed: `npm install`

---

## 🔨 Build Commands

### Preview APK (Testing/Internal Distribution)
```bash
eas build --platform android --profile preview
```
**Output:** APK file (easy to install)  
**Time:** 5-15 minutes  
**Use:** Internal testing, direct distribution

### Production AAB (Google Play Store)
```bash
eas build --platform android --profile production
```
**Output:** AAB file (optimized)  
**Time:** 10-20 minutes  
**Use:** Play Store submission

---

## 📱 Check Build Status

```bash
# List all builds
eas build:list

# View specific build
eas build:view [BUILD_ID]

# Cancel running build
eas build:cancel
```

---

## 📥 Distribution

### Direct APK Installation
1. Build preview APK
2. Share download link
3. Users enable "Unknown Sources"
4. Install APK

### Google Play Store
1. Build production AAB
2. Upload to Play Console
3. Submit for review

---

## 🔍 Troubleshooting

### Build fails?
```bash
eas logout
eas login
eas build --platform android --profile preview
```

### APK won't install?
- Enable "Install from Unknown Sources"
- Uninstall old version first
- Check Android version (5.0+)

### App crashes?
- Verify backend: https://stayflow-tkto.onrender.com/health
- Check API URL in `src/api/api.js`
- View logs: `adb logcat`

---

## 📝 Version Info

**Current Version:** 1.1.0  
**Backend:** StayFlow v2.0 (Security Enhanced)  
**Min Android:** 5.0 (API 21)  
**Package:** com.stayflow.mobile

---

## 🔗 Useful Links

- **Expo Dashboard:** https://expo.dev/accounts/goeswar98/projects/stayflow-mobile
- **Build Docs:** https://docs.expo.dev/build/introduction/
- **Backend:** https://stayflow-tkto.onrender.com

---

## ⚡ One-Liner Build

```bash
cd mobile && npm install && eas build --platform android --profile preview
```

---

## 📞 Support

**Issues?** Check `MOBILE_APK_UPDATE_GUIDE.md` for detailed instructions
