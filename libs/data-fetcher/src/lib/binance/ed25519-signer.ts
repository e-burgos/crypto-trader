import { createPrivateKey, sign as cryptoSign } from 'node:crypto';

export interface Ed25519Signer {
  sign(params: Record<string, string>): string;
}

export function buildSignaturePayload(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
}

export function createEd25519Signer(privateKeyPem: string, passphrase?: string): Ed25519Signer {
  const key = createPrivateKey({
    key: privateKeyPem,
    format: 'pem',
    passphrase,
  });

  if (key.asymmetricKeyType !== 'ed25519') {
    throw new Error(
      `Expected an Ed25519 private key, got '${key.asymmetricKeyType ?? 'unknown'}'`,
    );
  }

  return {
    sign(params: Record<string, string>): string {
      const payload = buildSignaturePayload(params);
      return cryptoSign(null, Buffer.from(payload, 'utf8'), key).toString('base64');
    },
  };
}

export function redactWsApiRequest<T extends { params: Record<string, string> }>(frame: T): T {
  const redactedParams: Record<string, string> = { ...frame.params };
  if ('apiKey' in redactedParams) {
    redactedParams['apiKey'] = '***';
  }
  if ('signature' in redactedParams) {
    redactedParams['signature'] = '***';
  }
  return { ...frame, params: redactedParams };
}
