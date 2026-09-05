import { createPrivateKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createEd25519Signer, type Ed25519Signer } from '@crypto-trader/data-fetcher';
import type { CredentialEnv } from './user-data-stream.service';
import type {
  UserStreamAuthCredentialPort,
  UserStreamAuthResolution,
} from './user-stream-auth-credential.port';

interface EnvVarNames {
  apiKey: string;
  privateKey: string;
  privateKeyPath: string;
  passphrase: string;
}

function envVarNamesFor(env: CredentialEnv): EnvVarNames {
  const infix = env === 'testnet' ? 'TESTNET_' : '';
  return {
    apiKey: `BINANCE_API_${infix}ED25519_KEY`,
    privateKey: `BINANCE_API_${infix}ED25519_PRIVATE_KEY`,
    privateKeyPath: `BINANCE_API_${infix}ED25519_PRIVATE_KEY_PATH`,
    passphrase: `BINANCE_API_${infix}ED25519_PRIVATE_KEY_PASSPHRASE`,
  };
}

function normalizePem(raw: string): string {
  return raw.replace(/\\n/g, '\n').trim();
}

function nonEmpty(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

function isUserIdInScope(userId: string): boolean {
  const raw = nonEmpty(process.env['USER_DATA_STREAM_ED25519_USER_IDS']);
  if (raw === undefined) return true;

  const scopedUserIds = raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  return scopedUserIds.includes(userId);
}

type PrivateKeySource =
  | { kind: 'FILE'; pem: string }
  | { kind: 'INLINE'; pem: string }
  | { kind: 'NONE' }
  | { kind: 'INVALID'; reason: 'UNREADABLE_KEY_FILE' };

function readPrivateKeySource(names: EnvVarNames): PrivateKeySource {
  const path = nonEmpty(process.env[names.privateKeyPath]);
  if (path !== undefined) {
    try {
      return { kind: 'FILE', pem: readFileSync(path, 'utf8') };
    } catch {
      return { kind: 'INVALID', reason: 'UNREADABLE_KEY_FILE' };
    }
  }

  const inline = nonEmpty(process.env[names.privateKey]);
  return inline !== undefined ? { kind: 'INLINE', pem: inline } : { kind: 'NONE' };
}

function resolveEnvCredential(env: CredentialEnv): UserStreamAuthResolution {
  const names = envVarNamesFor(env);
  const apiKey = nonEmpty(process.env[names.apiKey]);
  if (apiKey === undefined) {
    return { kind: 'ABSENT' };
  }

  const source = readPrivateKeySource(names);
  if (source.kind === 'INVALID') {
    return source;
  }
  if (source.kind === 'NONE') {
    return { kind: 'ABSENT' };
  }

  const passphrase = nonEmpty(process.env[names.passphrase]);
  const normalizedPem = normalizePem(source.pem);

  let asymmetricKeyType: string | undefined;
  try {
    asymmetricKeyType = createPrivateKey({
      key: normalizedPem,
      format: 'pem',
      passphrase,
    }).asymmetricKeyType;
  } catch {
    return { kind: 'INVALID', reason: 'MALFORMED_PEM' };
  }

  if (asymmetricKeyType !== 'ed25519') {
    return { kind: 'INVALID', reason: 'NOT_ED25519' };
  }

  const signer: Ed25519Signer = createEd25519Signer(normalizedPem, passphrase);
  return { kind: 'RESOLVED', apiKey, signer };
}

export class EnvUserStreamAuthCredentialResolver implements UserStreamAuthCredentialPort {
  private readonly resolutionByEnv = new Map<CredentialEnv, UserStreamAuthResolution>();

  async resolve(userId: string, env: CredentialEnv): Promise<UserStreamAuthResolution> {
    if (!isUserIdInScope(userId)) {
      return { kind: 'ABSENT' };
    }

    return this.resolutionFor(env);
  }

  private resolutionFor(env: CredentialEnv): UserStreamAuthResolution {
    const cached = this.resolutionByEnv.get(env);
    if (cached) return cached;

    const resolution = resolveEnvCredential(env);
    this.resolutionByEnv.set(env, resolution);
    return resolution;
  }
}
