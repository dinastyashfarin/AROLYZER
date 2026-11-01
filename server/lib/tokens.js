import crypto from 'node:crypto';
export const newToken = () => crypto.randomBytes(24).toString('base64url');
