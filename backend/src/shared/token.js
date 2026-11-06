// Creates and checks login tokens (JWTs) — the signed "visitor badge".

import { SignJWT, jwtVerify } from 'jose';
import env from '../config/env.js';

// jose needs the secret as bytes, not text.
const secretKey = new TextEncoder().encode(env.jwtSecret);
const ALGORITHM = 'HS256';

// Make a token for this user. It contains only the user's id and role —
// never a password or private details, because anyone can read a token's contents.
export function createToken(user) {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(user.id) // "sub" = who this token belongs to
    .setIssuedAt() // when it was made
    .setExpirationTime(env.jwtExpiresIn) // when it stops working, e.g. "8h"
    .sign(secretKey); // the stamp only our server can make
}

// Check a token. Throws an error if the stamp is fake, the token was edited,
// or it has expired. Returns the token's contents if it is valid.
export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, secretKey, { algorithms: [ALGORITHM] });
  return payload;
}