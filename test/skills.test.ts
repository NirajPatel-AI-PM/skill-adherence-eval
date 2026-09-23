import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSkills, parseSkill } from '../src/skills.ts';

const md = (name: string, description: string, body: string) => `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;

test('parses front matter and keeps the body', () => {
  const s = parseSkill(md('spec', 'Use before building.', '# Spec\n\nWrite it.'));
  assert.deepEqual(s, { name: 'spec', description: 'Use before building.', body: '# Spec\n\nWrite it.' });
});

test('rejects a skill with no description', () => {
  assert.throws(() => parseSkill('---\nname: x\n---\nbody'), /description/);
});

test('loads every SKILL.md in a folder, sorted by name', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sae-'));
  for (const n of ['rice', 'spec']) {
    mkdirSync(join(dir, n));
    writeFileSync(join(dir, n, 'SKILL.md'), md(n, `about ${n}`, 'b'));
  }
  assert.deepEqual(loadSkills(dir).map((s) => s.name), ['rice', 'spec']);
});
