// Scrambles (hashes) passwords and checks them.
// The database only ever stores the scrambled version, never the real password.

import bcrypt from 'bcryptjs';

// How much work bcrypt does. Higher = slower to crack, but also slower to log in.
// 10 is a common, safe choice.
const SALT_ROUNDS = 10;

export function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

// Returns true if the typed password matches the stored scrambled one.
export function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}