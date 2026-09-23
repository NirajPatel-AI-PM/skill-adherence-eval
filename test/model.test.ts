import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MissingRecording, callModel, keyOf, setRepeat } from '../src/model.ts';

const req = { system: 's', messages: [{ role: 'user' as const, content: 'one' }], maxTokens: 8 };

test('the key changes when the request changes', () => {
  assert.notEqual(keyOf(req), keyOf({ ...req, system: 't' }));
});

test('repeat 0 keeps the plain key, and later repeats get their own', () => {
  setRepeat(0);
  const k0 = keyOf(req);
  setRepeat(1);
  const k1 = keyOf(req);
  setRepeat(0);
  assert.notEqual(k0, k1);
  assert.equal(keyOf(req), k0);
});

test('replay refuses to invent a response', async () => {
  await assert.rejects(() => callModel({ ...req, system: 'never recorded' }, 'replay'), MissingRecording);
});
