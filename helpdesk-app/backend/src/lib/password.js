import argon2 from 'argon2';

// OWASP Password Storage Cheat Sheet minimum for argon2id: 19 MiB memory, 2 iterations, 1 lane.
const HASH_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

/** @param {string} password */
export const hashPassword = (password) => argon2.hash(password, HASH_OPTIONS);

/**
 * @param {string} hash
 * @param {string} password
 */
export async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

let dummyHash;
/**
 * Burn roughly the same CPU as a real verification when the email is unknown,
 * so response timing doesn't reveal which emails are registered.
 * @param {string} password
 */
export async function verifyAgainstDummy(password) {
  dummyHash ??= await hashPassword('dummy-password-for-timing-equalisation');
  await verifyPassword(dummyHash, password);
  return false;
}
