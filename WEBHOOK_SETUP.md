# Webhook Configuration Guide

## 🚀 Your Render URL
`https://stayflow-tkto.onrender.com`

## 📱 WhatsApp Cloud API Webhook Setup

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Select your app → WhatsApp → Configuration
3. Set Webhook URL:
   ```
   https://stayflow-tkto.onrender.com/webhook
   ```
4. Set Verify Token (from your .env):
   ```
   STAYFLOW_SECURE_TOKEN_2026_XYZ
   ```
5. Subscribe to webhook fields:
   - ✅ messages
   - ✅ message_status (optional)

## 💳 Razorpay Webhook Setup

1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Navigate to Settings → Webhooks
3. Click "Add New Webhook"
4. Set Webhook URL:
   ```
   https://stayflow-tkto.onrender.com/webhook/razorpay
   ```
5. Select events to subscribe:
   - ✅ payment.captured
   - ✅ payment_link.paid
   - ✅ order.paid (optional)
6. Set Active URL: `https://stayflow-tkto.onrender.com/webhook/razorpay`
7. Save the webhook secret (if provided) - add to .env as `RAZORPAY_WEBHOOK_SECRET`

## 🔄 Keep-Alive Service

The app now includes an automatic keep-alive service that:
- Pings `/health` endpoint every 14 minutes
- Prevents Render free tier from sleeping after 15 minutes of inactivity
- Starts automatically when the server starts

### Health Check Endpoint
```
GET https://stayflow-tkto.onrender.com/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-19T...",
  "uptime": 12345
}
```

## ✅ Testing Your Setup

### Test WhatsApp Webhook
Send a message to your WhatsApp Business number and check server logs.

### Test Razorpay Webhook
1. Create a test payment link
2. Complete payment using test card
3. Check if payment is auto-verified in your system

### Test Keep-Alive
Monitor your Render logs - you should see:
```
[KEEP-ALIVE] ✅ Ping successful at 2026-03-19T...
```

## 🔧 Environment Variables Updated

Your `.env` now includes:
- `WHATSAPP_CALLBACK_URL=https://stayflow-tkto.onrender.com/webhook`
- `RENDER_API_URL=https://stayflow-tkto.onrender.com`
- Updated `ALLOWED_ORIGINS` to include the new Render URL

## 📝 Notes

- Render free tier sleeps after 15 minutes of inactivity
- Keep-alive pings every 14 minutes to prevent sleep
- First request after sleep may take 30-60 seconds to wake up
- Consider upgrading to paid tier for instant responses
