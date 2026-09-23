import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caseFromIssue, runCheck, validateCases, type Case } from '../src/cases.ts';

const skills = [{ name: 'spec', description: 'd', body: 'b' }];
const ok: Case = { id: 'c1', request: 'r', expectSkill: 'spec', checks: [{ label: 'has outcome', kind: 'contains', value: 'Outcome' }], origin: 'designed' };

test('a valid case set has no problems', () => {
  assert.deepEqual(validateCases([ok], skills), []);
});

test('flags duplicate ids, unknown skills, and a skill case with no checks', () => {
  const problems = validateCases([ok, { ...ok }, { ...ok, id: 'c2', expectSkill: 'nope' }, { ...ok, id: 'c3', checks: [] }], skills);
  assert.equal(problems.length, 3);
  assert.ok(problems.some((p) => p.includes('duplicate id c1')));
  assert.ok(problems.some((p) => p.includes('unknown skill nope')));
  assert.ok(problems.some((p) => p.includes('c3 has no checks')));
});

test('a none case needs no checks', () => {
  assert.deepEqual(validateCases([{ ...ok, id: 'n1', expectSkill: null, checks: [] }], skills), []);
});

test('string checks are case-insensitive, and judge checks are left to the judge', () => {
  assert.equal(runCheck({ label: 'l', kind: 'contains', value: 'outcome' }, 'The OUTCOME is'), true);
  assert.equal(runCheck({ label: 'l', kind: 'absent', value: 'TBD' }, 'all decided'), true);
  assert.equal(runCheck({ label: 'l', kind: 'regex', value: '^#\\s' }, '# Title'), true);
  assert.equal(runCheck({ label: 'l', kind: 'judge', criterion: 'c' }, 'x'), null);
});

test('a reported issue becomes a case that remembers where it came from', () => {
  const c = caseFromIssue({ id: 'i1', issue: 'It wrote a spec with no measure.', request: 'r', expectSkill: 'spec', checks: ok.checks });
  assert.equal(c.origin, 'reported-issue');
  assert.equal(c.issue, 'It wrote a spec with no measure.');
});
