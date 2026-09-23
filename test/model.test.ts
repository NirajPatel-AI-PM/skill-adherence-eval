import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { MissingRecording, callModel, keyOf, scrub, setRepeat } from '../src/model.ts';

const req = { system: 's', messages: [{ role: 'user' as const, content: 'one' }] };

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

test('a request with its own model gets a different key', () => {
  assert.notEqual(keyOf({ ...req, model: 'j' }), keyOf(req));
});

test('the judge key does not depend on MODEL_LABEL, but the plain key does', () => {
  const run = (label: string) =>
    JSON.parse(execFileSync(process.execPath, ['test/fixtures/print-keys.ts'], { env: { ...process.env, MODEL_LABEL: label }, encoding: 'utf8' }));
  const a = run('a');
  const b = run('b');
  assert.notEqual(a.plain, b.plain);
  assert.equal(a.judge, b.judge);
});

test('scrub replaces the login email and the company name it implies', () => {
  const id = { email: 'pat@acme.example', orgName: 'Acme' };
  assert.equal(scrub('Author: Pat@Acme.example, security@acme.example, ACME team, acmeish', id), 'Author: <user email>, security@<user org>.example, <user org> team, acmeish');
  assert.equal(scrub('no login facts', {}), 'no login facts');
});
