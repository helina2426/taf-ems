// Unit tests for login tokens and passwords (security).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashPassword, verifyPassword } from '../../src/shared/password.js';
import { createToken, passwordStamp, verifyToken } from '../../src/shared/token.js';

describe('passwords', () => {
  it('never stores the password itself, and recognises the right one', async () => {
    const hash = await hashPassword('ChangeMe123!');
    assert.notEqual(hash, 'ChangeMe123!');
    assert.equal(await verifyPassword('ChangeMe123!', hash), true);
    assert.equal(await verifyPassword('wrong', hash), false);
  });

  it('gives a different hash each time (salt), even for the same password', async () => {
    assert.notEqual(await hashPassword('Same1234'), await hashPassword('Same1234'));
  });
});

describe('tokens', () => {
  const user = { id: '11111111-1111-4111-8111-111111111111', role: 'EMPLOYEE' };

  it('a token made by the server is accepted, and says who it belongs to', async () => {
    const token = await createToken(user, 'some-password-hash');
    const payload = await verifyToken(token);
    assert.equal(payload.sub, user.id);
    assert.equal(payload.role, 'EMPLOYEE');
  });

  it('an edited token is refused (changing the role breaks the signature)', async () => {
    const token = await createToken(user, 'some-password-hash');
    const [header, payload, signature] = token.split('.');
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    data.role = 'HOLDING';
    const edited = [header, Buffer.from(JSON.stringify(data)).toString('base64url'), signature].join('.');
    await assert.rejects(verifyToken(edited));
  });

  it('the password stamp changes when the password hash changes', () => {
    assert.notEqual(passwordStamp('old-hash'), passwordStamp('new-hash'));
    assert.equal(passwordStamp('old-hash'), passwordStamp('old-hash'));
  });
});
