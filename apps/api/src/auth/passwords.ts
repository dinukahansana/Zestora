import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const keyLength = 64;
const parameters = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, parameters, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt1.${salt.toString('hex')}.${key.toString('hex')}`;
}

export async function verifyPassword(password: string, hash: string) {
  const [version, salt, key] = hash.split('.');
  if (version !== 'scrypt1' || !/^[a-f0-9]{32}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(key ?? '')) return false;
  return timingSafeEqual(await derive(password, Buffer.from(salt, 'hex')), Buffer.from(key, 'hex'));
}

// A missing account takes the same password-derivation path as an existing account.
export const dummyHash = `scrypt1.${randomBytes(16).toString('hex')}.${randomBytes(keyLength).toString('hex')}`;
