import type { Skill } from './skills.ts';

export type Check =
  | { label: string; kind: 'contains' | 'absent' | 'regex'; value: string }
  | { label: string; kind: 'judge'; criterion: string };

export type Case = {
  id: string;
  request: string;
  expectSkill: string | null;
  checks: Check[];
  origin: 'designed' | 'reported-issue';
  issue?: string;
};

export function validateCases(cases: Case[], skills: Skill[]): string[] {
  const names = new Set(skills.map((s) => s.name));
  const seen = new Set<string>();
  const problems: string[] = [];
  for (const c of cases) {
    if (seen.has(c.id)) problems.push(`duplicate id ${c.id}`);
    seen.add(c.id);
    if (c.expectSkill !== null && !names.has(c.expectSkill)) problems.push(`${c.id} expects unknown skill ${c.expectSkill}`);
    if (c.expectSkill !== null && c.checks.length === 0) problems.push(`${c.id} has no checks`);
  }
  return problems;
}

export function caseFromIssue(input: { id: string; issue: string; request: string; expectSkill: string | null; checks: Check[] }): Case {
  return { ...input, origin: 'reported-issue' };
}

export function runCheck(check: Check, output: string): boolean | null {
  if (check.kind === 'judge') return null;
  if (check.kind === 'regex') return new RegExp(check.value, 'ims').test(output);
  const has = output.toLowerCase().includes(check.value.toLowerCase());
  return check.kind === 'contains' ? has : !has;
}
