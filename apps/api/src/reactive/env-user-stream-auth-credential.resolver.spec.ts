import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync, verify as cryptoVerify } from 'node:crypto';
import { EnvUserStreamAuthCredentialResolver } from './env-user-stream-auth-credential.resolver';

const ENV_KEYS = [
  'BINANCE_API_TESTNET_ED25519_KEY',
  'BINANCE_API_TESTNET_ED25519_PRIVATE_KEY',
  'BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PATH',
  'BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PASSPHRASE',
  'BINANCE_API_ED25519_KEY',
  'BINANCE_API_ED25519_PRIVATE_KEY',
  'BINANCE_API_ED25519_PRIVATE_KEY_PATH',
  'BINANCE_API_ED25519_PRIVATE_KEY_PASSPHRASE',
  'USER_DATA_STREAM_ED25519_USER_IDS',
] as const;

function generateEd25519Pem(): { privateKeyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

function generateRsaPem(): string {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
}

describe('EnvUserStreamAuthCredentialResolver', () => {
  const originalEnv: Record<string, string | undefined> = {};
  let tempDir: string;

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
    tempDir = mkdtempSync(join(tmpdir(), 'uds-ed25519-'));
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('ABSENT — HU-08 CA-1/CA-2/CA-4', () => {
    it('resolves ABSENT when no Ed25519 variable is set at all', async () => {
      const resolver = new EnvUserStreamAuthCredentialResolver();

      const resolution = await resolver.resolve('user-1', 'testnet');

      expect(resolution).toEqual({ kind: 'ABSENT' });
    });

    it('resolves ABSENT when the API key is set but neither private key form is', async () => {
      process.env['BINANCE_API_TESTNET_ED25519_KEY'] = 'some-api-key';
      const resolver = new EnvUserStreamAuthCredentialResolver();

      const resolution = await resolver.resolve('user-1', 'testnet');

      expect(resolution).toEqual({ kind: 'ABSENT' });
    });

    it('resolves ABSENT for testnet independently of live variables (HU-08 CA-4 style isolation)', async () => {
      const { privateKeyPem } = generateEd25519Pem();
      process.env['BINANCE_API_ED25519_KEY'] = 'live-api-key';
      process.env['BINANCE_API_ED25519_PRIVATE_KEY'] = privateKeyPem;
      const resolver = new EnvUserStreamAuthCredentialResolver();

      const resolution = await resolver.resolve('user-1', 'testnet');

      expect(resolution).toEqual({ kind: 'ABSENT' });
    });

    it('resolves RESOLVED for one credential and ABSENT for the other when only one is configured (HU-08 CA-4)', async () => {
      const { privateKeyPem } = generateEd25519Pem();
      process.env['BINANCE_API_TESTNET_ED25519_KEY'] = 'testnet-api-key';
      process.env['BINANCE_API_TESTNET_ED25519_PRIVATE_KEY'] = privateKeyPem;
      const resolver = new EnvUserStreamAuthCredentialResolver();

      const testnetResolution = await resolver.resolve('user-1', 'testnet');
      const liveResolution = await resolver.resolve('user-1', 'live');

      expect(testnetResolution.kind).toBe('RESOLVED');
      expect(liveResolution).toEqual({ kind: 'ABSENT' });
    });
  });

  describe('scoping by USER_DATA_STREAM_ED25519_USER_IDS — HU-08 CA-4', () => {
    it('applies to every user when the scope list is unset', async () => {
      const { privateKeyPem } = generateEd25519Pem();
      process.env['BINANCE_API_TESTNET_ED25519_KEY'] = 'testnet-api-key';
      process.env['BINANCE_API_TESTNET_ED25519_PRIVATE_KEY'] = privateKeyPem;
      const resolver = new EnvUserStreamAuthCredentialResolver();

      const resolution = await resolver.resolve('any-user-id', 'testnet');

      expect(resolution.kind).toBe('RESOLVED');
    });

    it('resolves RESOLVED for a user in scope and ABSENT for a user out of scope', async () => {
      const { privateKeyPem } = generateEd25519Pem();
      process.env['BINANCE_API_TESTNET_ED25519_KEY'] = 'testnet-api-key';
      process.env['BINANCE_API_TESTNET_ED25519_PRIVATE_KEY'] = privateKeyPem;
      process.env['USER_DATA_STREAM_ED25519_USER_IDS'] = 'user-a, user-c';
      const resolver = new EnvUserStreamAuthCredentialResolver();

      const scopedIn = await resolver.resolve('user-a', 'testnet');
      const scopedOut = await resolver.resolve('user-b', 'testnet');

      expect(scopedIn.kind).toBe('RESOLVED');
      expect(scopedOut).toEqual({ kind: 'ABSENT' });
    });
  });

  describe('INVALID — HU-08 CE-1', () => {
    it('resolves INVALID/UNREADABLE_KEY_FILE when the path does not point to a readable file', async () => {
      process.env['BINANCE_API_TESTNET_ED25519_KEY'] = 'testnet-api-key';
      process.env['BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PATH'] = join(
        tempDir,
        'does-not-exist.pem',
      );
      const resolver = new EnvUserStreamAuthCredentialResolver();

      const resolution = await resolver.resolve('user-1', 'testnet');

      expect(resolution).toEqual({ kind: 'INVALID', reason: 'UNREADABLE_KEY_FILE' });
    });

    it('resolves INVALID/MALFORMED_PEM for a corrupted PEM', async () => {
      process.env['BINANCE_API_TESTNET_ED25519_KEY'] = 'testnet-api-key';
      process.env['BINANCE_API_TESTNET_ED25519_PRIVATE_KEY'] =
        '-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----';
      const resolver = new EnvUserStreamAuthCredentialResolver();

      const resolution = await resolver.resolve('user-1', 'testnet');

      expect(resolution).toEqual({ kind: 'INVALID', reason: 'MALFORMED_PEM' });
    });

    it('resolves INVALID/NOT_ED25519 for a well-formed non-Ed25519 (RSA) key', async () => {
      process.env['BINANCE_API_TESTNET_ED25519_KEY'] = 'testnet-api-key';
      process.env['BINANCE_API_TESTNET_ED25519_PRIVATE_KEY'] = generateRsaPem();
      const resolver = new EnvUserStreamAuthCredentialResolver();

      const resolution = await resolver.resolve('user-1', 'testnet');

      expect(resolution).toEqual({ kind: 'INVALID', reason: 'NOT_ED25519' });
    });
  });

  describe('RESOLVED — the two PEM delivery forms (§1.3)', () => {
    it('resolves RESOLVED from BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PATH (recommended form)', async () => {
      const { privateKeyPem, publicKeyPem } = generateEd25519Pem();
      const pemPath = join(tempDir, 'testnet-ed25519-private.pem');
      writeFileSync(pemPath, privateKeyPem, 'utf8');
      process.env['BINANCE_API_TESTNET_ED25519_KEY'] = 'testnet-api-key';
      process.env['BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PATH'] = pemPath;
      const resolver = new EnvUserStreamAuthCredentialResolver();

      const resolution = await resolver.resolve('user-1', 'testnet');

      expect(resolution.kind).toBe('RESOLVED');
      if (resolution.kind !== 'RESOLVED') throw new Error('unreachable');
      expect(resolution.apiKey).toBe('testnet-api-key');

      const params = { apiKey: resolution.apiKey, timestamp: '1' };
      const signature = resolution.signer.sign(params);
      const verified = cryptoVerify(
        null,
        Buffer.from('apiKey=testnet-api-key&timestamp=1', 'utf8'),
        publicKeyPem,
        Buffer.from(signature, 'base64'),
      );
      expect(verified).toBe(true);
    });

    it('resolves RESOLVED from an inline PEM with literal \\n escapes, in one line (form b)', async () => {
      const { privateKeyPem, publicKeyPem } = generateEd25519Pem();
      const escapedOneLine = privateKeyPem.trim().replace(/\n/g, '\\n');
      process.env['BINANCE_API_TESTNET_ED25519_KEY'] = 'testnet-api-key';
      process.env['BINANCE_API_TESTNET_ED25519_PRIVATE_KEY'] = escapedOneLine;
      const resolver = new EnvUserStreamAuthCredentialResolver();

      const resolution = await resolver.resolve('user-1', 'testnet');

      expect(resolution.kind).toBe('RESOLVED');
      if (resolution.kind !== 'RESOLVED') throw new Error('unreachable');

      const params = { apiKey: 'testnet-api-key', timestamp: '2' };
      const signature = resolution.signer.sign(params);
      const verified = cryptoVerify(
        null,
        Buffer.from('apiKey=testnet-api-key&timestamp=2', 'utf8'),
        publicKeyPem,
        Buffer.from(signature, 'base64'),
      );
      expect(verified).toBe(true);
    });

    it('resolves RESOLVED from an inline multiline PEM (form c)', async () => {
      const { privateKeyPem } = generateEd25519Pem();
      process.env['BINANCE_API_TESTNET_ED25519_KEY'] = 'testnet-api-key';
      process.env['BINANCE_API_TESTNET_ED25519_PRIVATE_KEY'] = privateKeyPem;
      const resolver = new EnvUserStreamAuthCredentialResolver();

      const resolution = await resolver.resolve('user-1', 'testnet');

      expect(resolution.kind).toBe('RESOLVED');
    });

    it('resolves RESOLVED for a passphrase-protected private key', async () => {
      const { privateKey, publicKey } = generateKeyPairSync('ed25519');
      const passphrase = 'correct-horse-battery-staple';
      const encryptedPem = privateKey
        .export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase })
        .toString();
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
      process.env['BINANCE_API_TESTNET_ED25519_KEY'] = 'testnet-api-key';
      process.env['BINANCE_API_TESTNET_ED25519_PRIVATE_KEY'] = encryptedPem;
      process.env['BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PASSPHRASE'] = passphrase;
      const resolver = new EnvUserStreamAuthCredentialResolver();

      const resolution = await resolver.resolve('user-1', 'testnet');

      expect(resolution.kind).toBe('RESOLVED');
      if (resolution.kind !== 'RESOLVED') throw new Error('unreachable');

      const signature = resolution.signer.sign({ apiKey: 'x', timestamp: '1' });
      const verified = cryptoVerify(
        null,
        Buffer.from('apiKey=x&timestamp=1', 'utf8'),
        publicKeyPem,
        Buffer.from(signature, 'base64'),
      );
      expect(verified).toBe(true);
    });

    it('prefers PRIVATE_KEY_PATH over PRIVATE_KEY when both are set', async () => {
      const { privateKeyPem: filePem, publicKeyPem: filePublicPem } = generateEd25519Pem();
      const otherRsaPem = generateRsaPem();
      const pemPath = join(tempDir, 'testnet-ed25519-private.pem');
      writeFileSync(pemPath, filePem, 'utf8');
      process.env['BINANCE_API_TESTNET_ED25519_KEY'] = 'testnet-api-key';
      process.env['BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PATH'] = pemPath;
      process.env['BINANCE_API_TESTNET_ED25519_PRIVATE_KEY'] = otherRsaPem;
      const resolver = new EnvUserStreamAuthCredentialResolver();

      const resolution = await resolver.resolve('user-1', 'testnet');

      expect(resolution.kind).toBe('RESOLVED');
      if (resolution.kind !== 'RESOLVED') throw new Error('unreachable');

      const signature = resolution.signer.sign({ apiKey: 'x', timestamp: '1' });
      const verified = cryptoVerify(
        null,
        Buffer.from('apiKey=x&timestamp=1', 'utf8'),
        filePublicPem,
        Buffer.from(signature, 'base64'),
      );
      expect(verified).toBe(true);
    });
  });

  describe('memoization per env', () => {
    it('returns the same resolution object across calls for the same env without re-reading the file', async () => {
      const { privateKeyPem } = generateEd25519Pem();
      const pemPath = join(tempDir, 'testnet-ed25519-private.pem');
      writeFileSync(pemPath, privateKeyPem, 'utf8');
      process.env['BINANCE_API_TESTNET_ED25519_KEY'] = 'testnet-api-key';
      process.env['BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PATH'] = pemPath;
      const resolver = new EnvUserStreamAuthCredentialResolver();

      const first = await resolver.resolve('user-1', 'testnet');
      rmSync(pemPath, { force: true });
      const second = await resolver.resolve('user-2', 'testnet');

      expect(second).toBe(first);
    });
  });

  describe('material safety', () => {
    it('never exposes the private key or the signature through JSON.stringify of the resolution', async () => {
      const { privateKeyPem } = generateEd25519Pem();
      process.env['BINANCE_API_TESTNET_ED25519_KEY'] = 'testnet-api-key';
      process.env['BINANCE_API_TESTNET_ED25519_PRIVATE_KEY'] = privateKeyPem;
      const resolver = new EnvUserStreamAuthCredentialResolver();

      const resolution = await resolver.resolve('user-1', 'testnet');
      if (resolution.kind !== 'RESOLVED') throw new Error('unreachable');

      const sentinelSignature = resolution.signer.sign({
        apiKey: 'PRIVATE-KEY-SENTINEL-CHECK',
        timestamp: '1',
      });
      const serialized = JSON.stringify({ ...resolution, signature: undefined });

      expect(serialized).not.toContain(privateKeyPem);
      expect(serialized).not.toContain(sentinelSignature);
      expect(JSON.stringify(resolution.signer)).toBe('{}');
    });
  });
});
