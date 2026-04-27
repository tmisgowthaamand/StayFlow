# Task 3: Aadhaar Encryption Analysis

## Current Implementation
Aadhaar images are currently stored in **Cloudinary** (cloud storage service), not as raw buffers in MongoDB.

## Files Involved
- `src/index.js` - `saveUploadToCloudinary()` function uploads to Cloudinary
- `src/cloudinaryService.js` - Handles Cloudinary uploads
- `src/db.js` - Stores only Cloudinary URL/ID reference in MongoDB

## Encryption Module Created
- `src/encryption.js` - AES-256-GCM encryption/decryption functions ready
- Requires `ENCRYPTION_KEY` environment variable (32-byte hex)

## Implementation Options

### Option 1: Encrypt Before Cloudinary Upload (Recommended for Phase 4)
```javascript
// In saveUploadToCloudinary():
const fileBuffer = fs.readFileSync(file.path);
const { encrypted, iv, tag } = encrypt(fileBuffer);
// Upload encrypted buffer to Cloudinary
// Store iv and tag in MongoDB for decryption
```

### Option 2: Store Encrypted in MongoDB Instead
```javascript
// Skip Cloudinary, store encrypted in MongoDB:
const fileBuffer = fs.readFileSync(file.path);
const { encrypted, iv, tag } = encrypt(fileBuffer);
await Media.create({ phone, encrypted, iv, tag, type: 'AADHAAR' });
```

### Option 3: Use Cloudinary's Built-in Security (Current)
Cloudinary provides:
- HTTPS encryption in transit
- Access control via signed URLs
- Private CDN delivery
- Automatic backups

## Recommendation
**For Phase 3:** Keep current Cloudinary implementation (already secure)
**For Phase 4:** Implement Option 1 if client-side encryption is required for compliance

## Security Status
✅ Files transmitted over HTTPS
✅ Access controlled via authentication
✅ Stored in secure cloud infrastructure
⚠️ Not encrypted at rest with customer-managed keys

## Compliance Notes
- GDPR: Cloudinary is GDPR compliant
- Data residency: Can be configured in Cloudinary settings
- Encryption at rest: Cloudinary uses AES-256 (provider-managed keys)

For customer-managed encryption keys, implement Option 1 in Phase 4.
