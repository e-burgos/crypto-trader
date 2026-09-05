import type { Ed25519Signer } from '@crypto-trader/data-fetcher';
import type { CredentialEnv } from './user-data-stream.service';

export const USER_STREAM_AUTH_CREDENTIAL = Symbol('USER_STREAM_AUTH_CREDENTIAL');

export type UserStreamAuthInvalidReason =
  | 'UNREADABLE_KEY_FILE'
  | 'MALFORMED_PEM'
  | 'NOT_ED25519';

export type UserStreamAuthResolution =
  | { kind: 'RESOLVED'; apiKey: string; signer: Ed25519Signer }
  | { kind: 'ABSENT' }
  | { kind: 'INVALID'; reason: UserStreamAuthInvalidReason };

export interface UserStreamAuthCredentialPort {
  resolve(userId: string, env: CredentialEnv): Promise<UserStreamAuthResolution>;
}
