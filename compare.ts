import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { summarize, type Row } from './src/report.ts';

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : 'n/a');

export function compareTable(runs: Array<{ label: string; rows: Row[] }>): string {
  const lines = ['| Run | Selection | Adherence | Noise floor |', '| --- | --- | --- | --- |'];
  for (const { label, rows } of runs) {
    const s = summarize(rows);
    const floor = s.noiseFloor === null ? 'n/a' : `${Math.round(s.noiseFloor * 100)} points`;
    lines.push(`| ${label} | ${pct(s.selection.correct, s.selection.total)} | ${pct(s.adherence.adherent, s.adherence.total)} | ${floor} |`);
  }
  return lines.join('\n');
}

if (import.meta.filename === resolve(process.argv[1] ?? '')) {
  const dirs = process.argv.slice(2);
  console.log(compareTable(dirs.map((d) => ({ label: basename(d), rows: JSON.parse(readFileSync(`${d}/rows.json`, 'utf8')) as Row[] }))));
}
