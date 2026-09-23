import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateCases, type Case } from './src/cases.ts';
import { JUDGE_MODEL, MissingRecording, MODEL_LABEL, setRepeat, type Mode } from './src/model.ts';
import { rubricVersion } from './src/prompts.ts';
import { renderAnswers, renderReport, type Row } from './src/report.ts';
import { runCase } from './src/run.ts';
import { loadSkills } from './src/skills.ts';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};

const mode: Mode = process.argv.includes('--live') ? 'live' : 'replay';
const skillsDir = arg('skills', 'examples/team-os/skills');
const casesPath = arg('cases', 'examples/team-os/cases.json');
const out = arg('out', 'results');
const repeatsArg = arg('repeats', '1');
const repeats = Number(repeatsArg);
if (!Number.isInteger(repeats) || repeats < 1) {
  console.error(`--repeats must be a positive integer, got ${repeatsArg}`);
  process.exit(1);
}

const skills = loadSkills(resolve(skillsDir));
const cases = JSON.parse(readFileSync(casesPath, 'utf8')) as Case[];
const problems = validateCases(cases, skills);
if (problems.length) {
  console.error(`cases are not valid:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

const rubric = readFileSync('RUBRIC.md', 'utf8');
const rows: Row[] = [];
try {
  for (let r = 0; r < repeats; r++) {
    setRepeat(r);
    for (const c of cases) rows.push({ model: MODEL_LABEL, repeat: r, ...(await runCase(c, skills, rubric, mode)) });
  }
} catch (err) {
  if (err instanceof MissingRecording) {
    console.error(err.message);
    process.exit(2);
  }
  throw err;
}

const report = renderReport(rows, { model: MODEL_LABEL, judge: JUDGE_MODEL, rubric: rubricVersion(), skills: skillsDir, mode });
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/report.md`, report);
writeFileSync(`${out}/answers.md`, renderAnswers(rows, new Map(cases.map((c) => [c.id, c.request]))));
writeFileSync(`${out}/rows.json`, JSON.stringify(rows, null, 2) + '\n');
console.log(report.split('## Adherence by skill')[0]);
console.log(`full report: ${out}/report.md, every answer: ${out}/answers.md`);
