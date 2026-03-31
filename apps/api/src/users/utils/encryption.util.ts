import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const key = process.env.BINANCE_KEY_ENCRYPTION_KEY || '';
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `BINANCE_KEY_ENCRYPTION_KEY must be exactly ${KEY_LENGTH} characters`,
    );
  }
  return Buffer.from(key, 'utf8');
}

export function encrypt(plaintext: string): { encrypted: string; iv: string } {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Store authTag appended to encrypted for verification on decrypt
  const combined = Buffer.concat([encrypted, authTag]);
  return {
    encrypted: combined.toString('base64'),
    iv: iv.toString('base64'),
  };
}

export function decrypt(encrypted: string, iv: string): string {
  const combined = Buffer.from(encrypted, 'base64');
  const ivBuffer = Buffer.from(iv, 'base64');
  const authTag = combined.subarray(combined.length - 16);
  const encryptedData = combined.subarray(0, combined.length - 16);
  const decipher = createDecipheriv(ALGORITHM, getKey(), ivBuffer);
  decipher.setAuthTag(authTag);
  return (
    decipher.update(encryptedData) + decipher.final('utf8')
  );
}
