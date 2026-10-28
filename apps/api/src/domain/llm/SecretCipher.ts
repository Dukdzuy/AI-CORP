/**
 * SecretCipher
 *
 * Reversible encryption for secrets the platform has to send on (provider API keys),
 * unlike user passwords and integration keys, which are only hashed. The domain depends
 * on this port; the infrastructure layer supplies AES-256-GCM.
 *
 * @pattern Port (Dependency Inversion)
 */
export interface SecretCipher {
  encrypt(plain: string): string;
  decrypt(sealed: string): string;
}

export const SECRET_CIPHER = Symbol('SecretCipher');
