import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { agreement, type Rating } from './src/agreement.ts';
import type { Row } from './src/report.ts';

const dir = process.argv[2] ?? 'results';
const rows = (JSON.parse(readFileSync(`${dir}/rows.json`, 'utf8')) as Row[]).filter((r) => r.adherent !== null);
const cases = new Map((JSON.parse(readFileSync(process.argv[3] ?? 'examples/team-os/cases.json', 'utf8')) as Array<{ id: string; request: string }>).map((c) => [c.id, c.request]));

const ratingsPath = `${dir}/ratings.json`;
const ratings: Rating[] = existsSync(ratingsPath) ? (JSON.parse(readFileSync(ratingsPath, 'utf8')) as Rating[]) : [];
const rated = new Set(ratings.map((r) => `${r.caseId}:${r.repeat}`));

// Shuffled and stripped of the harness verdict, so the person rates the work, not the score.
const order = rows.filter((r) => !rated.has(`${r.caseId}:${r.repeat}`)).map((r) => ({ r, k: Math.random() })).sort((a, b) => a.k - b.k).map((x) => x.r);
const rl = createInterface({ input: process.stdin, output: process.stdout });
for (const [i, r] of order.entries()) {
  const request = cases.get(r.caseId);
  console.log(`\n--- ${i + 1} of ${order.length} ---\nRequest: ${request}\n\n${r.output}\n`);
  // A long answer scrolls the request off screen, so it is repeated next to the question.
  console.log(`--- End of answer ${i + 1} of ${order.length}. The request was: ${request}`);
  let a = '';
  while (a !== 'y' && a !== 'n' && a !== 'q') a = (await rl.question('Rate the whole answer. If a teammate gave you this for that request, would you use it? [y]es, [n]o, [q]uit: ')).trim().toLowerCase();
  if (a === 'q') break;
  ratings.push({ caseId: r.caseId, repeat: r.repeat, rating: a === 'y' ? 'up' : 'down' });
  writeFileSync(ratingsPath, JSON.stringify(ratings, null, 2) + '\n');
}
rl.close();
const g = agreement(rows, ratings);
console.log(`\nRated ${g.n}. Thumbs up: ${g.up}. The harness agreed with you on ${g.agree} of ${g.n}.`);
