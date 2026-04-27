import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import config from './config.js';

// In production, store hashed passwords in MongoDB.
// For now, hash on startup from env var.
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(config.adminPassword, 10);

export function generateToken(username) {
    return jwt.sign({ username, role: 'admin' }, config.jwtSecret, { expiresIn: '24h' });
}

export function verifyToken(token) {
    return jwt.verify(token, config.jwtSecret);
}

export function validatePassword(password) {
    return bcrypt.compareSync(password, ADMIN_PASSWORD_HASH);
}
