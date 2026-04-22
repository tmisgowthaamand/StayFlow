# 🚀 Quick Razorpay Test Reference

## ⚡ Fastest Way to Test Payment

### 1. Open Payment Link
```
http://localhost:3000/payment.html?phone=917010905730&name=Vikram%20Singh
```

### 2. Click "Pay ₹7400 Now"

### 3. Select UPI → Add New UPI ID

### 4. Enter Test UPI ID
```
success@razorpay
```

### 5. Click Continue → Payment Succeeds → Redirects to WhatsApp

### 6. Send Message → Receive Invoice PDF

---

## 🎯 Test Credentials (Copy-Paste Ready)

### ✅ Test UPI ID (RECOMMENDED)
```
success@razorpay
```

### ✅ Test Card Number
```
4111 1111 1111 1111
```

### ✅ Test CVV
```
123
```

### ✅ Test Expiry
```
12/25
```

---

## 🔍 Why Your Payment Failed

The error "Payment could not be completed" with ID `rzp_test_SgWYZfyUuvQl5f` means:

❌ **Payment was cancelled** - You clicked "Cancel" or closed the modal
❌ **Wrong credentials** - Didn't use `success@razorpay`
❌ **Network timeout** - Connection lost during payment

---

## ✅ How to Fix

### Try Again With:
1. Use **exactly** `success@razorpay` (all lowercase, no spaces)
2. Don't cancel the payment
3. Wait for "Payment Successful" message
4. Let it redirect to WhatsApp
5. Send the pre-filled message

---

## 📱 Expected Flow

```
[Payment Page]
Click "Pay Now"
    ↓
[Razorpay Modal]
Select UPI → Add New UPI ID
Enter: success@razorpay
    ↓
[Payment Success]
"Payment Successful! Verifying..."
    ↓
[WhatsApp Opens]
Pre-filled: "Paid successfully using Razorpay"
Send message
    ↓
[Bot Response]
✅ Payment Confirmed!
📄 Invoice PDF attached
```

---

## 🎬 Video Tutorial Steps

1. **Open browser** → Go to payment link
2. **See bill** → ₹7400 (₹7000 rent + ₹400 EB)
3. **Click Pay** → Razorpay modal opens
4. **Click UPI** → Click "Add New UPI ID"
5. **Type** → `success@razorpay`
6. **Click Continue** → Payment processes
7. **See success** → "Payment Successful!"
8. **WhatsApp opens** → Message pre-filled
9. **Send message** → Bot responds
10. **Receive PDF** → Invoice attached

---

## 🐛 Still Not Working?

### Check These:

1. **Backend Running?**
   ```bash
   curl http://localhost:3000/api/payment-info?phone=917010905730
   ```
   Should return: `{"name":"Vikram Singh",...}`

2. **Razorpay Keys Correct?**
   ```bash
   # Check .env file
   cat .env | grep RAZORPAY
   ```
   Should show: `RAZORPAY_KEY_ID=rzp_test_RxL3Ftiwabk6Wd`

3. **Internet Connected?**
   - Razorpay needs internet to process payments

4. **Browser Console Errors?**
   - Press F12 → Check Console tab
   - Look for red errors

---

## 💡 Pro Tips

### ✅ DO:
- Use `success@razorpay` for UPI
- Use `4111 1111 1111 1111` for card
- Complete the payment flow
- Wait for WhatsApp redirect
- Send the pre-filled message

### ❌ DON'T:
- Use real UPI ID in test mode
- Cancel the payment
- Close the modal early
- Skip the WhatsApp message
- Use production credentials in test

---

## 📊 Current System Status

### Vikram Singh (Test User)
```
Phone: 917010905730
Room: 303
Status: PENDING
Rent: ₹7000
EB: ₹400
Total: ₹7400
```

✅ Ready for test payment!

---

## 🎯 Success Checklist

After successful payment, verify:

- [ ] Razorpay shows "Payment Successful"
- [ ] Page shows "Verifying..."
- [ ] WhatsApp opens automatically
- [ ] Message is pre-filled
- [ ] Bot sends confirmation
- [ ] Bot sends invoice PDF
- [ ] Status changes to PAID

---

## 📞 Need Help?

### Check Logs:
```bash
# Backend logs
tail -f debug.log

# Or check process output
# Look for "Payment" or "Razorpay" entries
```

### Test API:
```bash
# Test payment info
curl http://localhost:3000/api/payment-info?phone=917010905730

# Test create order
curl -X POST http://localhost:3000/api/create-order \
  -H "Content-Type: application/json" \
  -d '{"phone":"917010905730","name":"Vikram Singh","amount":7400}'
```

---

## 🚀 Ready to Test?

1. Copy this UPI ID: `success@razorpay`
2. Open: http://localhost:3000/payment.html?phone=917010905730
3. Click "Pay Now"
4. Select UPI → Add New UPI ID
5. Paste: `success@razorpay`
6. Click Continue
7. Wait for WhatsApp redirect
8. Send message
9. Receive invoice! 🎉

---

**Remember**: The payment you tried (`rzp_test_SgWYZfyUuvQl5f`) was cancelled. Just try again with `success@razorpay` and complete the flow! 💪
