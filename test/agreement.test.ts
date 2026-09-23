import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agreement } from '../src/agreement.ts';
import type { Row } from '../src/report.ts';

const row = (caseId: string, adherent: boolean): Row => ({
  model: 'm', repeat: 0, caseId, origin: 'designed', expectSkill: 'spec', selected: 'spec', selectionCorrect: true, checks: [], adherent, output: 'o',
});

test('counts thumbs up and how often the harness agrees with the person', () => {
  const a = agreement([row('a', true), row('b', true), row('c', false)], [
    { caseId: 'a', repeat: 0, rating: 'up' },
    { caseId: 'b', repeat: 0, rating: 'down' },
    { caseId: 'c', repeat: 0, rating: 'down' },
  ]);
  assert.deepEqual(a, { n: 3, up: 1, agree: 2 });
});

test('ignores ratings for rows that do not exist', () => {
  assert.deepEqual(agreement([row('a', true)], [{ caseId: 'zz', repeat: 0, rating: 'up' }]), { n: 0, up: 0, agree: 0 });
});
