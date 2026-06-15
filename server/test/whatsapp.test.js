/**
 * Unit tests for the WhatsApp/Kapso service. No framework — Node's built-in
 * runner. Run with:  node --test test/whatsapp.test.js
 *
 * The service reads env at call time, so each test sets the env it needs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  normalizePhone,
  isEnabled,
  verifyWebhookSignature,
  isValidMsisdn,
} from '../src/services/whatsappService.js';

function resetEnv() {
  delete process.env.KAPSO_API_KEY;
  delete process.env.KAPSO_PHONE_NUMBER_ID;
  delete process.env.KAPSO_WEBHOOK_SECRET;
  delete process.env.NODE_ENV;
  process.env.WHATSAPP_COUNTRY_CODE = '91';
}

test('normalizePhone: 10-digit national number gets country code prepended', () => {
  resetEnv();
  assert.equal(normalizePhone('9876543210'), '919876543210');
  assert.equal(normalizePhone('98765 43210'), '919876543210');
  assert.equal(normalizePhone('987-654-3210'), '919876543210');
});

test('normalizePhone: numbers with a country code pass through (digits only)', () => {
  resetEnv();
  assert.equal(normalizePhone('+91 98765 43210'), '919876543210');
  assert.equal(normalizePhone('+965 1234 5678'), '96512345678');
  assert.equal(normalizePhone('919876543210'), '919876543210');
});

test('normalizePhone: empty / null / junk → empty string', () => {
  resetEnv();
  assert.equal(normalizePhone(''), '');
  assert.equal(normalizePhone(null), '');
  assert.equal(normalizePhone(undefined), '');
  assert.equal(normalizePhone('abc'), '');
});

test('isValidMsisdn: accepts 8–15 digits, rejects the rest', () => {
  assert.equal(isValidMsisdn('96512345678'), '96512345678');
  assert.equal(isValidMsisdn('+965 1234 5678'), '96512345678');
  assert.equal(isValidMsisdn('1234567'), '');        // 7 digits — too short
  assert.equal(isValidMsisdn('1234567890123456'), ''); // 16 digits — too long
  assert.equal(isValidMsisdn(''), '');
});

test('isEnabled: false when unconfigured, true only when both creds set', () => {
  resetEnv();
  assert.equal(isEnabled(), false);
  process.env.KAPSO_API_KEY = 'k';
  assert.equal(isEnabled(), false);          // phone id still missing
  process.env.KAPSO_PHONE_NUMBER_ID = '123';
  assert.equal(isEnabled(), true);
});

test('verifyWebhookSignature: accepts a valid signature over the raw bytes', () => {
  resetEnv();
  process.env.KAPSO_WEBHOOK_SECRET = 'shhh';
  const raw = Buffer.from(JSON.stringify({ entry: [{ id: '1' }] }));
  const sig = crypto.createHmac('sha256', 'shhh').update(raw).digest('hex');
  assert.equal(verifyWebhookSignature(raw, sig), true);
  assert.equal(verifyWebhookSignature(raw, `sha256=${sig}`), true); // prefixed form
});

test('verifyWebhookSignature: rejects a tampered body', () => {
  resetEnv();
  process.env.KAPSO_WEBHOOK_SECRET = 'shhh';
  const raw = Buffer.from('{"a":1}');
  const sig = crypto.createHmac('sha256', 'shhh').update(raw).digest('hex');
  const tampered = Buffer.from('{"a":2}');
  assert.equal(verifyWebhookSignature(tampered, sig), false);
});

test('verifyWebhookSignature: rejects missing rawBody / missing signature', () => {
  resetEnv();
  process.env.KAPSO_WEBHOOK_SECRET = 'shhh';
  const raw = Buffer.from('{"a":1}');
  const sig = crypto.createHmac('sha256', 'shhh').update(raw).digest('hex');
  assert.equal(verifyWebhookSignature(undefined, sig), false); // no rawBody
  assert.equal(verifyWebhookSignature('{"a":1}', sig), false); // string, not Buffer
  assert.equal(verifyWebhookSignature(raw, ''), false);        // no signature
  assert.equal(verifyWebhookSignature(raw, 'not-hex'), false); // garbage signature
});

test('verifyWebhookSignature: fails CLOSED in production when no secret is set', () => {
  resetEnv();
  // no KAPSO_WEBHOOK_SECRET
  process.env.NODE_ENV = 'production';
  const raw = Buffer.from('{"a":1}');
  assert.equal(verifyWebhookSignature(raw, 'anything'), false);
});

test('verifyWebhookSignature: tolerates missing secret ONLY in non-production', () => {
  resetEnv();
  // no secret, no NODE_ENV (dev)
  const raw = Buffer.from('{"a":1}');
  assert.equal(verifyWebhookSignature(raw, 'anything'), true);
});
