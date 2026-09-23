import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Skill = { name: string; description: string; body: string };

// reads single-line name and description only; multi-line YAML values are not supported.
export function parseSkill(text: string): Skill {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) throw new Error('SKILL.md has no front matter');
  const field = (k: string) => new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(m[1])?.[1].trim();
  const name = field('name');
  const description = field('description');
  if (!name) throw new Error('SKILL.md front matter has no name');
  if (!description) throw new Error(`skill ${name} has no description`);
  return { name, description, body: m[2].trim() };
}

export function loadSkills(dir: string): Skill[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'SKILL.md')))
    .map((d) => parseSkill(readFileSync(join(dir, d.name, 'SKILL.md'), 'utf8')))
    .sort((a, b) => a.name.localeCompare(b.name));
}
