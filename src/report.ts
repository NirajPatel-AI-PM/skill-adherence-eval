import type { Case } from './cases.ts';
import type { Mode } from './model.ts';

export type CheckResult = { label: string; pass: boolean };
export type Row = {
  model: string;
  repeat: number;
  caseId: string;
  origin: Case['origin'];
  expectSkill: string | null;
  selected: string | null | undefined;
  selectionCorrect: boolean;
  checks: CheckResult[];
  adherent: boolean | null;
  output: string;
};
export type Summary = {
  cases: number;
  repeats: number;
  selection: { correct: number; total: number };
  adherence: { adherent: number; total: number };
  perSkill: Array<{ skill: string; adherent: number; total: number }>;
  failedChecks: Array<{ label: string; count: number }>;
  noiseFloor: number | null;
};

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : 'n/a');

export function summarize(rows: Row[]): Summary {
  const scored = rows.filter((r) => r.adherent !== null);
  const repeats = [...new Set(rows.map((r) => r.repeat))];

  const perSkillMap = new Map<string, { adherent: number; total: number }>();
  for (const r of scored) {
    const p = perSkillMap.get(r.expectSkill!) ?? { adherent: 0, total: 0 };
    p.total++;
    if (r.adherent) p.adherent++;
    perSkillMap.set(r.expectSkill!, p);
  }
  const failed = new Map<string, number>();
  for (const r of scored) for (const k of r.checks) if (!k.pass) failed.set(k.label, (failed.get(k.label) ?? 0) + 1);

  const rates = repeats.map((n) => {
    const rs = scored.filter((r) => r.repeat === n);
    return rs.length ? rs.filter((r) => r.adherent).length / rs.length : 0;
  });

  return {
    cases: new Set(rows.map((r) => r.caseId)).size,
    repeats: repeats.length,
    selection: { correct: rows.filter((r) => r.selectionCorrect).length, total: rows.length },
    adherence: { adherent: scored.filter((r) => r.adherent).length, total: scored.length },
    perSkill: [...perSkillMap.entries()].map(([skill, p]) => ({ skill, ...p })).sort((a, b) => a.skill.localeCompare(b.skill)),
    failedChecks: [...failed.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    noiseFloor: repeats.length > 1 ? Math.max(...rates) - Math.min(...rates) : null,
  };
}

export function renderReport(rows: Row[], meta: { model: string; judge: string; rubric: string; skills: string; mode: Mode }): string {
  const s = summarize(rows);
  const misses = rows.filter((r) => !r.selectionCorrect);
  return [
    '# Skill adherence: results',
    '',
    `Mode: ${meta.mode}. Model: ${meta.model}. Judge: ${meta.judge}. Rubric: \`${meta.rubric}\`. Skills: ${meta.skills}.`,
    `${s.cases} cases, ${s.repeats} repeats, ${rows.length} rows.`,
    '',
    '## Totals',
    '',
    `- Selection: ${s.selection.correct} of ${s.selection.total} correct (${pct(s.selection.correct, s.selection.total)}).`,
    `- Adherence: ${s.adherence.adherent} of ${s.adherence.total} passed every check (${pct(s.adherence.adherent, s.adherence.total)}).`,
    s.noiseFloor === null
      ? '- Noise floor: not measured, one repeat. Treat small differences as noise.'
      : `- Noise floor: ${Math.round(s.noiseFloor * 100)} points, the spread of the adherence rate between repeats. A smaller difference is not evidence.`,
    '',
    '## Adherence by skill',
    '',
    '| Skill | Adherent | Of | Rate |',
    '| --- | --- | --- | --- |',
    ...s.perSkill.map((p) => `| ${p.skill} | ${p.adherent} | ${p.total} | ${pct(p.adherent, p.total)} |`),
    '',
    '## Checks that failed most',
    '',
    ...(s.failedChecks.length ? s.failedChecks.slice(0, 10).map((f) => `- ${f.label}: ${f.count}`) : ['- none']),
    '',
    '## Selection misses',
    '',
    ...(misses.length ? misses.map((r) => `- ${r.caseId} (repeat ${r.repeat}): expected ${r.expectSkill ?? 'none'}, got ${r.selected === undefined ? 'no answer' : r.selected ?? 'none'}`) : ['- none']),
    '',
    '## What these numbers do not mean',
    '',
    '- The cases and the skills have the same author. A second author would write harder cases.',
    '- A language model judges some checks. The rubric is pinned by hash, but a judge is not a person.',
    '- The selection prompt approximates how an agent finds skills. It is not any product\'s own prompt.',
    '',
  ].join('\n');
}

export function renderAnswers(rows: Row[], requests: Map<string, string>): string {
  const mark = (ok: boolean | null) => (ok === null ? 'n/a' : ok ? 'PASS' : 'FAIL');
  const blocks = rows.map((r) => [
    `## ${r.caseId}, repeat ${r.repeat}`,
    '',
    `Request: ${requests.get(r.caseId) ?? ''}`,
    '',
    `- Selection: ${mark(r.selectionCorrect)}. Expected ${r.expectSkill ?? 'none'}, picked ${r.selected === undefined ? 'an unparseable answer' : r.selected ?? 'none'}.`,
    `- Adherence: ${mark(r.adherent)}.`,
    ...r.checks.map((k) => `  - ${mark(k.pass)}: ${k.label}`),
    ...(r.output ? ['', '### Answer', '', r.output] : []),
  ].join('\n'));
  return ['# Skill adherence: answers', '', ...blocks].join('\n\n') + '\n';
}
