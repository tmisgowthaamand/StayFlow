import crypto from 'crypto';
import config from './config.js';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(config.encryptionKey, 'hex'); // 32 bytes

export function encrypt(buffer) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { encrypted, iv, tag };
}

export function decrypt({ encrypted, iv, tag }) {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(iv));
    decipher.setAuthTag(Buffer.from(tag));
    return Buffer.concat([decipher.update(Buffer.from(encrypted)), decipher.final()]);
}
