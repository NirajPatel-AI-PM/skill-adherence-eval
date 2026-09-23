import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adherenceRequest, judgeRequest, parseJudge, parseSelection, selectionRequest } from '../src/prompts.ts';

const skills = [
  { name: 'rice', description: 'Use when choosing between requests.', body: '# RICE' },
  { name: 'spec', description: 'Use before building.', body: '# Spec\n\nWrite it.' },
];

test('selection lists every skill by name and description, and not their bodies', () => {
  const r = selectionRequest(skills, 'help me decide');
  assert.match(r.system, /- rice: Use when choosing between requests\./);
  assert.match(r.system, /- spec: Use before building\./);
  assert.ok(!r.system.includes('Write it.'));
  assert.equal(r.messages[0].content, 'help me decide');
});

test('selection parses a name, none, and garbage', () => {
  assert.equal(parseSelection('SKILL: spec'), 'spec');
  assert.equal(parseSelection('Thinking...\nSKILL: none'), null);
  assert.equal(parseSelection('I would use the spec skill'), undefined);
});

test('adherence gives the model the skill body and the request', () => {
  const r = adherenceRequest(skills[1], 'write a spec for search');
  assert.ok(r.system.includes('Write it.'));
  assert.ok(r.system.includes('output its full contents'));
  assert.equal(r.messages[0].content, 'write a spec for search');
});

test('the judge sees numbered criteria and never the model label', () => {
  const r = judgeRequest('RUBRIC', 'req', 'out', ['has an outcome', 'has a measure']);
  assert.match(r.messages[0].content, /C1: has an outcome\nC2: has a measure/);
  assert.ok(!r.messages[0].content.includes('claude'));
});

test('judge output parses in order and fails closed', () => {
  assert.deepEqual(parseJudge('C1: PASS\nC2: FAIL', 2), [true, false]);
  assert.equal(parseJudge('C1: PASS', 2), null);
});
