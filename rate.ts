import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { agreement, type Rating } from './src/agreement.ts';
import type { Row } from './src/report.ts';

const dir = process.argv[2] ?? 'results';
const rows = (JSON.parse(readFileSync(`${dir}/rows.json`, 'utf8')) as Row[]).filter((r) => r.adherent !== null);
const cases = new Map((JSON.parse(readFileSync(process.argv[3] ?? 'examples/team-os/cases.json', 'utf8')) as Array<{ id: string; request: string }>).map((c) => [c.id, c.request]));

// Shuffled and stripped of the harness verdict, so the person rates the work, not the score.
const order = rows.map((r) => ({ r, k: Math.random() })).sort((a, b) => a.k - b.k).map((x) => x.r);
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ratings: Rating[] = [];
for (const [i, r] of order.entries()) {
  console.log(`\n--- ${i + 1} of ${order.length} ---\nRequest: ${cases.get(r.caseId)}\n\n${r.output}\n`);
  let a = '';
  while (a !== 'u' && a !== 'd' && a !== 'q') a = (await rl.question('Would you use this? [u]p, [d]own, [q]uit: ')).trim();
  if (a === 'q') break;
  ratings.push({ caseId: r.caseId, repeat: r.repeat, rating: a === 'u' ? 'up' : 'down' });
}
rl.close();
writeFileSync(`${dir}/ratings.json`, JSON.stringify(ratings, null, 2) + '\n');
const g = agreement(rows, ratings);
console.log(`\nRated ${g.n}. Thumbs up: ${g.up}. The harness agreed with you on ${g.agree} of ${g.n}.`);
