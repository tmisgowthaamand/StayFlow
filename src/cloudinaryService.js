import axios from 'axios';
import crypto from 'crypto';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import config from './config.js';

class CloudinaryService {
    isConfigured() {
        return Boolean(config.cloudinary?.cloudName && config.cloudinary?.apiKey && config.cloudinary?.apiSecret);
    }

    getUploadUrl(resourceType = 'auto') {
        if (!this.isConfigured()) {
            throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.');
        }
        return `https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/${resourceType}/upload`;
    }

    signParams(params) {
        const sorted = Object.keys(params)
            .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
            .sort()
            .map((key) => `${key}=${params[key]}`)
            .join('&');

        return crypto
            .createHash('sha1')
            .update(sorted + config.cloudinary.apiSecret)
            .digest('hex');
    }

    async uploadLocalFile(filePath, options = {}) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found for Cloudinary upload: ${filePath}`);
        }

        const filename = options.filename || path.basename(filePath);
        return this.uploadStream(fs.createReadStream(filePath), {
            ...options,
            filename,
        });
    }

    async uploadBuffer(buffer, options = {}) {
        const filename = options.filename || `media-${Date.now()}`;
        return this.uploadStream(buffer, {
            ...options,
            filename,
        });
    }

    async uploadStream(fileValue, options = {}) {
        if (!this.isConfigured()) {
            throw new Error('Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
        }

        const timestamp = Math.floor(Date.now() / 1000);
        const folder = options.folder || 'stayflow/aadhaar';
        const publicId = options.publicId || `stayflow_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
        const mimeType = options.mimeType || 'application/octet-stream';

        // Determine resource type based on MIME type
        let resourceType = 'auto';  // Let Cloudinary auto-detect best resource type
        if (mimeType.startsWith('image/')) {
            resourceType = 'image';
        } else if (mimeType.startsWith('video/')) {
            resourceType = 'video';
        } else if (mimeType === 'application/pdf') {
            resourceType = 'image';  // Upload PDF as image for preview generation
        }

        const signedParams = {
            folder,
            public_id: publicId,
            timestamp,
        };

        const form = new FormData();
        form.append('file', fileValue, {
            filename: options.filename || publicId,
            contentType: mimeType,
        });
        form.append('api_key', config.cloudinary.apiKey);
        form.append('timestamp', timestamp);
        form.append('folder', folder);
        form.append('public_id', publicId);
        form.append('signature', this.signParams(signedParams));

        try {
            const uploadUrl = this.getUploadUrl(resourceType);
            console.log('[CLOUDINARY] Uploading to:', uploadUrl);
            console.log('[CLOUDINARY] Folder:', folder, 'PublicId:', publicId, 'ResourceType:', resourceType, 'MimeType:', mimeType);

            const response = await axios.post(uploadUrl, form, {
                headers: form.getHeaders(),
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                timeout: 60000, // 60 second timeout
            });

            console.log('[CLOUDINARY] Upload successful:', response.data.public_id);

            return {
                provider: 'cloudinary',
                publicId: response.data.public_id,
                url: response.data.secure_url,
                resourceType: response.data.resource_type,
                format: response.data.format,
                bytes: response.data.bytes,
                originalFilename: response.data.original_filename,
            };
        } catch (err) {
            const errorMsg = err.response?.data?.error?.message || err.message || 'Unknown Cloudinary error';
            const statusCode = err.response?.status || 'N/A';
            console.error('[CLOUDINARY] Upload failed:', errorMsg, 'Status:', statusCode);
            console.error('[CLOUDINARY] Error details:', err.response?.data);
            throw new Error(`Cloudinary upload failed: ${errorMsg}`);
        }
    }

    async uploadWhatsAppMedia(mediaId, options = {}) {
        const urlResponse = await axios.get(`https://graph.facebook.com/v17.0/${mediaId}`, {
            headers: { Authorization: `Bearer ${config.whatsapp.token}` },
        });

        const mediaResponse = await axios.get(urlResponse.data.url, {
            headers: { Authorization: `Bearer ${config.whatsapp.token}` },
            responseType: 'arraybuffer',
        });

        const mimeType = mediaResponse.headers['content-type'] || options.mimeType || 'image/jpeg';
        const extension = this.extensionFromMimeType(mimeType);
        const filename = options.filename || `whatsapp-${mediaId}${extension}`;

        return this.uploadBuffer(Buffer.from(mediaResponse.data), {
            ...options,
            filename,
            mimeType,
        });
    }

    extensionFromMimeType(mimeType) {
        const map = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
            'application/pdf': '.pdf',
        };
        return map[mimeType] || '';
    }
}

export default new CloudinaryService();
