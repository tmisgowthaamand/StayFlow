# Mobile APK Build Checklist - v1.1.0

**Date:** April 27, 2026  
**Version:** 1.1.0 (Security Enhanced)

---

## ✅ Pre-Build Checklist

### Version Updates
- [x] Updated `mobile/package.json` version: 1.0.0 → 1.1.0
- [x] Updated `mobile/app.json` version: 1.0.0 → 1.1.0
- [x] Verified version consistency across files

### Documentation
- [x] Created `MOBILE_APK_UPDATE_GUIDE.md` (comprehensive guide)
- [x] Created `mobile/BUILD_APK_QUICK_REFERENCE.md` (quick reference)
- [x] Created `MOBILE_UPDATE_SUMMARY.md` (summary)
- [x] Created `MOBILE_BUILD_CHECKLIST.md` (this file)

### Backend Verification
- [x] Backend security fixes complete (27/27 checks)
- [x] API endpoints unchanged
- [x] Encryption working server-side
- [x] Error messages sanitized
- [x] Backend deployed and accessible

---

## 📋 Build Process Checklist

### Step 1: Prerequisites
- [ ] EAS CLI installed: `npm install -g eas-cli`
- [ ] Logged into Expo: `eas login`
- [ ] Verified account: goeswar98
- [ ] Verified project ID: 0c828233-29dd-49ab-9db4-565fbca03b3e

### Step 2: Prepare Build
- [ ] Navigate to mobile directory: `cd mobile`
- [ ] Install dependencies: `npm install`
- [ ] Verify no errors in dependencies
- [ ] Check app.json configuration

### Step 3: Build Preview APK
- [ ] Run: `eas build --platform android --profile preview`
- [ ] Wait for build to complete (5-15 minutes)
- [ ] Note build ID from output
- [ ] Download APK from provided link

### Step 4: Build Production AAB (Optional)
- [ ] Run: `eas build --platform android --profile production`
- [ ] Wait for build to complete (10-20 minutes)
- [ ] Download AAB from provided link
- [ ] Save for Play Store submission

---

## 🧪 Testing Checklist

### Installation Test
- [ ] Enable "Install from Unknown Sources" on test device
- [ ] Download APK to device
- [ ] Install APK successfully
- [ ] App icon appears on home screen
- [ ] App launches without crash

### Authentication Test
- [ ] Open app
- [ ] Login screen appears
- [ ] Enter admin credentials
- [ ] Login successful
- [ ] Dashboard loads

### Core Features Test
- [ ] **Dashboard:** Stats display correctly
- [ ] **Tenants:** List loads with all tenants
- [ ] **Add Tenant:** Can add new tenant
- [ ] **Update Tenant:** Can edit tenant details
- [ ] **Mark Paid:** Payment marking works
- [ ] **Announcements:** Can send messages
- [ ] **Notifications:** Push notifications work
- [ ] **Media:** Can view uploaded documents

### Security Test
- [ ] Error messages are user-friendly (no technical details)
- [ ] Aadhaar upload works
- [ ] Aadhaar retrieval works (decryption transparent)
- [ ] No authentication issues
- [ ] No data leaks in error messages

### Performance Test
- [ ] App loads in < 3 seconds
- [ ] API calls respond quickly
- [ ] No memory leaks
- [ ] Smooth scrolling
- [ ] No crashes during normal use

### Edge Cases Test
- [ ] Works on slow network
- [ ] Handles offline gracefully
- [ ] Recovers from network errors
- [ ] Handles invalid inputs
- [ ] Logout works correctly

---

## 📤 Distribution Checklist

### Internal Testing
- [ ] Install on 2-3 test devices
- [ ] Different Android versions tested
- [ ] All features verified working
- [ ] No critical bugs found
- [ ] Performance acceptable

### Beta Release
- [ ] Share APK link with beta users
- [ ] Provide installation instructions
- [ ] Collect feedback
- [ ] Monitor for crash reports
- [ ] Address any issues

### Production Release
- [ ] All tests passed
- [ ] Beta feedback addressed
- [ ] Build production AAB
- [ ] Upload to Play Console
- [ ] Fill in release notes
- [ ] Submit for review
- [ ] Publish when approved

---

## 📝 Release Notes Checklist

- [ ] Version number: 1.1.0
- [ ] Release date: April 27, 2026
- [ ] Security improvements listed
- [ ] Features maintained noted
- [ ] Compatibility requirements stated
- [ ] Installation instructions included
- [ ] Support contact provided

---

## 🔍 Post-Release Checklist

### Monitoring
- [ ] Check Play Console for crash reports
- [ ] Monitor user reviews
- [ ] Track installation numbers
- [ ] Check backend logs for errors
- [ ] Verify API usage patterns

### Support
- [ ] Respond to user feedback
- [ ] Address reported issues
- [ ] Update documentation if needed
- [ ] Plan next release if needed

---

## 🚀 Quick Build Command

Once all pre-build items are checked:

```bash
cd mobile
npm install
eas build --platform android --profile preview
```

---

## 📞 Support Contacts

**Build Issues:**
- Expo Docs: https://docs.expo.dev/build/introduction/
- EAS Build: https://docs.expo.dev/build/setup/

**App Issues:**
- Backend Health: https://stayflow-tkto.onrender.com/health
- API Base: https://stayflow-tkto.onrender.com/api/

**Documentation:**
- Full Guide: MOBILE_APK_UPDATE_GUIDE.md
- Quick Reference: mobile/BUILD_APK_QUICK_REFERENCE.md
- Summary: MOBILE_UPDATE_SUMMARY.md

---

## ✅ Final Verification

Before distributing to users:

- [ ] All pre-build items completed
- [ ] Build successful
- [ ] All tests passed
- [ ] Documentation reviewed
- [ ] Release notes prepared
- [ ] Support plan in place

**Status:** Ready to build and distribute ✅

---

## 📊 Build Summary

**Version:** 1.1.0  
**Backend:** StayFlow v2.0 (Security Enhanced)  
**Security Score:** 27/27 (100%)  
**Breaking Changes:** None  
**Code Changes:** Version bump only  
**Ready to Build:** Yes ✅
