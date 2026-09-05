import { generateKeyPairSync, verify as cryptoVerify } from 'node:crypto';
import {
  buildSignaturePayload,
  createEd25519Signer,
  redactWsApiRequest,
} from './ed25519-signer';

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

describe('buildSignaturePayload', () => {
  it('sorts params ascending by key and joins without percent-encoding', () => {
    const payload = buildSignaturePayload({ timestamp: '2', apiKey: 'A+B/C=' });

    expect(payload).toBe('apiKey=A+B/C=&timestamp=2');
  });

  it('produces the exact session.logon payload shape', () => {
    const payload = buildSignaturePayload({ apiKey: 'my-api-key', timestamp: '1788574991966' });

    expect(payload).toBe('apiKey=my-api-key&timestamp=1788574991966');
  });
});

describe('createEd25519Signer', () => {
  it('produces a signature that verifies against the matching public key', () => {
    const { privateKeyPem, publicKeyPem } = generateEd25519Pem();
    const signer = createEd25519Signer(privateKeyPem);
    const params = { apiKey: 'my-api-key', timestamp: '1788574991966' };

    const signatureBase64 = signer.sign(params);
    const payload = buildSignaturePayload(params);

    const verified = cryptoVerify(
      null,
      Buffer.from(payload, 'utf8'),
      publicKeyPem,
      Buffer.from(signatureBase64, 'base64'),
    );

    expect(verified).toBe(true);
  });

  it('signs with a passphrase-protected private key', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const passphrase = 'correct-horse-battery-staple';
    const encryptedPem = privateKey
      .export({
        type: 'pkcs8',
        format: 'pem',
        cipher: 'aes-256-cbc',
        passphrase,
      })
      .toString();
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

    const signer = createEd25519Signer(encryptedPem, passphrase);
    const params = { apiKey: 'k', timestamp: '1' };
    const signatureBase64 = signer.sign(params);

    const verified = cryptoVerify(
      null,
      Buffer.from(buildSignaturePayload(params), 'utf8'),
      publicKeyPem,
      Buffer.from(signatureBase64, 'base64'),
    );

    expect(verified).toBe(true);
  });

  it('throws when given a non-Ed25519 (RSA) private key', () => {
    const rsaPem = generateRsaPem();

    expect(() => createEd25519Signer(rsaPem)).toThrow();
  });

  it('does not expose the private key material through JSON.stringify', () => {
    const { privateKeyPem } = generateEd25519Pem();
    const signer = createEd25519Signer(privateKeyPem);

    expect(JSON.stringify(signer)).toBe('{}');
  });
});

describe('redactWsApiRequest', () => {
  it('masks params.apiKey and params.signature and leaves the rest intact', () => {
    const frame = {
      id: 'req-1',
      method: 'session.logon' as const,
      params: {
        apiKey: 'super-secret-api-key',
        timestamp: '1788574991966',
        signature: 'super-secret-signature==',
      },
    };

    const redacted = redactWsApiRequest(frame);

    expect(redacted).toEqual({
      id: 'req-1',
      method: 'session.logon',
      params: {
        apiKey: '***',
        timestamp: '1788574991966',
        signature: '***',
      },
    });
  });

  it('does not mutate the original frame', () => {
    const frame = {
      id: 'req-1',
      method: 'session.logon' as const,
      params: { apiKey: 'secret', timestamp: '1' },
    };

    redactWsApiRequest(frame);

    expect(frame.params.apiKey).toBe('secret');
  });

  it('leaves params without apiKey or signature unchanged', () => {
    const frame = { id: 'req-2', method: 'ping' as const, params: {} };

    const redacted = redactWsApiRequest(frame);

    expect(redacted.params).toEqual({});
  });
});
