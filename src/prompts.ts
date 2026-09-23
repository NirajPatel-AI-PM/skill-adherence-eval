import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Request } from './model.ts';
import type { Skill } from './skills.ts';

// approximates how an agent discovers skills; it is not Claude Code's own prompt.
export function selectionRequest(skills: Skill[], request: string): Request {
  const list = skills.map((s) => `- ${s.name}: ${s.description}`).join('\n');
  return {
    system: `You can use these skills. Each has a name and says when to use it.\n\n${list}\n\nRead the user's request. If one skill applies, answer with one line: SKILL: <name>\nIf none applies, answer: SKILL: none`,
    messages: [{ role: 'user', content: request }],
    maxTokens: 64,
  };
}

export function parseSelection(text: string): string | null | undefined {
  const m = /SKILL:\W*([\w-]+)/i.exec(text);
  if (!m) return undefined;
  const name = m[1].toLowerCase();
  return name === 'none' ? null : name;
}

export function adherenceRequest(skill: Skill, request: string): Request {
  return {
    system: `Follow this skill to handle the user's request.\n\nYou cannot write files. Where the skill says to write a file, output its full contents instead.\n\n<skill name="${skill.name}">\n${skill.body}\n</skill>`,
    messages: [{ role: 'user', content: request }],
    maxTokens: 8192,
  };
}

export function judgeRequest(rubric: string, request: string, output: string, criteria: string[]): Request {
  const numbered = criteria.map((c, i) => `C${i + 1}: ${c}`).join('\n');
  return {
    system: rubric,
    messages: [{ role: 'user', content: `Request:\n${request}\n\nWork:\n${output}\n\nCriteria:\n${numbered}` }],
    maxTokens: 16 * criteria.length,
  };
}

export function parseJudge(text: string, count: number): boolean[] | null {
  const out: boolean[] = [];
  for (let i = 1; i <= count; i++) {
    const m = new RegExp(`C${i}:\\s*(PASS|FAIL)`).exec(text);
    if (!m) return null;
    out.push(m[1] === 'PASS');
  }
  return out;
}

export function rubricVersion(path = 'RUBRIC.md'): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 12);
}
