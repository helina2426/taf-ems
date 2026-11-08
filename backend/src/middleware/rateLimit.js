// Limits how many requests one computer can send in a period of time (SRS: security).
//
//   • apiLimiter   — every /api request. Stops one computer from flooding the server.
//   • loginLimiter — only FAILED logins, counted per email AND computer. After too many wrong
//                    passwords, that email is blocked from that computer for 15 minutes.
//                    This stops "password guessing" (trying thousands of passwords).
//
// Counters are kept in the server's memory, so restarting the server resets them.
// (With several servers in production, a shared store such as Redis would be used instead.)

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import env from '../config/env.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Our standard error format, with status 429 = "Too Many Requests".
function tooManyRequests(message) {
  return (req, res, next, options) => {
    res.status(options.statusCode).json({ success: false, error: { message, code: 'TOO_MANY_REQUESTS' } });
  };
}

export const apiLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: env.rateLimitMax,
  standardHeaders: 'draft-8', // tells the client its limit in the RateLimit headers
  legacyHeaders: false,
  handler: tooManyRequests('Too many requests. Please wait a few minutes and try again.'),
});

export const loginLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: env.loginMaxFailures,
  // Only count failed attempts (a status of 400 or more). Successful logins are not counted.
  skipSuccessfulRequests: true,
  // One counter per computer + email. Guessing one person's password does not block everyone else.
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email ?? '').trim().toLowerCase()}`,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooManyRequests('Too many failed login attempts. Please wait 15 minutes and try again.'),
});
