import type { Case } from './cases.ts';
import { runCheck } from './cases.ts';
import { callModel, JUDGE_MODEL, type Mode } from './model.ts';
import { adherenceRequest, judgeRequest, parseJudge, parseSelection, selectionRequest } from './prompts.ts';
import type { Row } from './report.ts';
import type { Skill } from './skills.ts';

export async function runCase(c: Case, skills: Skill[], rubric: string, mode: Mode): Promise<Omit<Row, 'model' | 'repeat'>> {
  const selected = parseSelection(await callModel(selectionRequest(skills, c.request), mode));
  const base = { caseId: c.id, origin: c.origin, expectSkill: c.expectSkill, selected, selectionCorrect: selected === c.expectSkill };
  if (c.expectSkill === null) return { ...base, checks: [], adherent: null, output: '' };

  // Adherence is measured on the expected skill whatever was selected, so the two numbers stay independent.
  const skill = skills.find((s) => s.name === c.expectSkill)!;
  const output = await callModel(adherenceRequest(skill, c.request), mode);

  const checks = c.checks.filter((k) => k.kind !== 'judge').map((k) => ({ label: k.label, pass: runCheck(k, output) === true }));
  const judged = c.checks.filter((k) => k.kind === 'judge');
  if (judged.length) {
    const criteria = judged.map((k) => (k.kind === 'judge' ? k.criterion : ''));
    const verdicts = parseJudge(await callModel({ ...judgeRequest(rubric, c.request, output, criteria), model: JUDGE_MODEL }, mode), criteria.length);
    judged.forEach((k, i) => checks.push({ label: k.label, pass: verdicts?.[i] ?? false }));
  }
  return { ...base, checks, adherent: checks.every((k) => k.pass), output };
}
