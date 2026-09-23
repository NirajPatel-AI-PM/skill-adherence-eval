import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderAnswers, renderReport, summarize, type Row } from '../src/report.ts';

const row = (repeat: number, caseId: string, expectSkill: string | null, selected: string | null, adherent: boolean | null, failed: string[] = []): Row => ({
  model: 'm', repeat, caseId, origin: 'designed', expectSkill, selected, selectionCorrect: selected === expectSkill,
  checks: failed.map((label) => ({ label, pass: false })), adherent, output: 'o',
});

const rows: Row[] = [
  row(0, 'a', 'spec', 'spec', true),
  row(0, 'b', 'spec', 'rice', false, ['has a measure']),
  row(0, 'n', null, null, null),
  row(1, 'a', 'spec', 'spec', true),
  row(1, 'b', 'spec', 'spec', true),
  row(1, 'n', null, 'spec', null),
];

test('selection and adherence are counted across every repeat', () => {
  const s = summarize(rows);
  assert.equal(s.cases, 3);
  assert.equal(s.repeats, 2);
  assert.deepEqual(s.selection, { correct: 4, total: 6 });
  assert.deepEqual(s.adherence, { adherent: 3, total: 4 });
  assert.deepEqual(s.perSkill, [{ skill: 'spec', adherent: 3, total: 4 }]);
  assert.deepEqual(s.failedChecks, [{ label: 'has a measure', count: 1 }]);
});

test('the noise floor is the spread of the adherence rate between repeats', () => {
  // repeat 0: 1 of 2 adherent; repeat 1: 2 of 2
  assert.equal(summarize(rows).noiseFloor, 0.5);
  assert.equal(summarize(rows.filter((r) => r.repeat === 0)).noiseFloor, null);
});

test('the report states the model, judge, rubric version and noise floor', () => {
  const md = renderReport(rows, { model: 'm', rubric: 'abc123', skills: 'x', mode: 'replay', judge: 'j' });
  assert.match(md, /Model: m\. Judge/);
  assert.match(md, /Judge: j/);
  assert.match(md, /Rubric: `abc123`/);
  assert.match(md, /Noise floor: 50 points/);
});


test('answers.md shows each request, its failed checks and the answer', () => {
  const md = renderAnswers(rows, new Map([['b', 'Write a spec.']]));
  assert.match(md, /## b, repeat 0\n\nRequest: Write a spec\./);
  assert.match(md, /Expected spec, picked rice/);
  assert.match(md, /FAIL: has a measure/);
  assert.match(md, /### Answer\n\no/);
});
