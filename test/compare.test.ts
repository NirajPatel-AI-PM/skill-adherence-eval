import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareTable } from '../compare.ts';
import type { Row } from '../src/report.ts';

const r = (adherent: boolean, selectionCorrect: boolean): Row => ({
  model: 'm', repeat: 0, caseId: String(Math.random()), origin: 'designed', expectSkill: 'spec', selected: 'spec',
  selectionCorrect, checks: [], adherent, output: '',
});

test('puts each run side by side with selection and adherence rates', () => {
  const t = compareTable([
    { label: 'older', rows: [r(true, true), r(false, true)] },
    { label: 'newer', rows: [r(true, true), r(true, false)] },
  ]);
  assert.match(t, /\| older \| 100% \| 50% \| n\/a \|/);
  assert.match(t, /\| newer \| 50% \| 100% \| n\/a \|/);
});
