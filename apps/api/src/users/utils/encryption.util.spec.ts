import { encrypt, decrypt } from './encryption.util';

describe('Encryption Util', () => {
  const originalEnv = process.env.BINANCE_KEY_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.BINANCE_KEY_ENCRYPTION_KEY =
      'dev-encryption-key-32-chars-long';
  });

  afterAll(() => {
    process.env.BINANCE_KEY_ENCRYPTION_KEY = originalEnv;
  });

  it('should encrypt and decrypt a string correctly', () => {
    const plaintext = 'my-secret-api-key-12345';
    const { encrypted, iv } = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(iv).toBeDefined();
    const decrypted = decrypt(encrypted, iv);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for the same input (random IV)', () => {
    const plaintext = 'same-input';
    const result1 = encrypt(plaintext);
    const result2 = encrypt(plaintext);
    expect(result1.encrypted).not.toBe(result2.encrypted);
    expect(result1.iv).not.toBe(result2.iv);
  });

  it('should fail decryption with wrong IV', () => {
    const { encrypted } = encrypt('test-data');
    const wrongIv = Buffer.from('aaaaaaaaaaaa').toString('base64');
    expect(() => decrypt(encrypted, wrongIv)).toThrow();
  });

  it('should fail if encryption key is wrong length', () => {
    const original = process.env.BINANCE_KEY_ENCRYPTION_KEY;
    process.env.BINANCE_KEY_ENCRYPTION_KEY = 'short-key';
    expect(() => encrypt('test')).toThrow(/must be exactly 32 characters/);
    process.env.BINANCE_KEY_ENCRYPTION_KEY = original;
  });

  it('should handle empty string', () => {
    const { encrypted, iv } = encrypt('');
    const decrypted = decrypt(encrypted, iv);
    expect(decrypted).toBe('');
  });

  it('should handle unicode characters', () => {
    const plaintext = '🔑 BTC key ñ日本語';
    const { encrypted, iv } = encrypt(plaintext);
    const decrypted = decrypt(encrypted, iv);
    expect(decrypted).toBe(plaintext);
  });
});
