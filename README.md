# Skill adherence eval

This eval measures whether a model picks the right skill for a request, and then follows it.

## Why

Teams write skills and assume they work. A skill that is never selected, or selected and then ignored, is worse than none, because people stop checking. I built an eval like this for an MCP server factory at work, where each tool gets a probe and a judge scores the agent's choice. This is the same method, rebuilt from scratch for skills, and it runs on any folder of `SKILL.md` files.

Each case gets two scores, and the eval keeps them apart.

- **Selection.** The model sees every skill's name and description, then names one skill or none. The case says which answer is right.
- **Adherence.** The model gets the full text of the expected skill and the request, and does the work. The case's checks score the output. The eval scores adherence on the expected skill even when selection missed, so a selection miss does not also count as an adherence failure.

The eval repeats every case `--repeats` times. The spread of the adherence rate between repeats is the noise floor, and the report says that a difference smaller than the noise floor is not evidence.

The eval records every model call to a JSON file named by a hash of the whole request: model, thinking, system, messages, and repeat when above 0. An edited skill changes the hash, so it can never reuse an old answer. Replay mode reads recordings and never calls the model. When a recording is missing, the eval prints the request key and exits 2 rather than invent a response.

## Run it

Replay a committed run:

```bash
RECORDINGS_DIR=runs/claude-sonnet-5/recordings MODEL_LABEL=claude-sonnet-5 node eval.ts --repeats 3
```

Replay reads a committed run under `runs/`. Two are committed, one per model generation. Replay needs no login, and a missing recording makes it exit 2 rather than invent a model response.

Run live on your own skills:

```bash
node eval.ts --live --skills path/to/skills --cases path/to/cases.json
```

Live mode runs `claude -p` for each request, so it uses your Claude Code login and needs no API key. Log in to Claude Code first. It calls the model only for requests that have no recording, and it records each answer, so a live run can be replayed later without logging in. The recordings hold the request and the answer, never a credential.

Each call runs in safe mode with no tools, so your own skills, plugins, hooks and `CLAUDE.md` stay out of it. The eval's prompt replaces Claude Code's system prompt.

| Flag or variable | Default | What it sets |
| --- | --- | --- |
| `--live` | off | Call the model through `claude -p` for missing recordings. Without it, the eval replays. |
| `--skills <dir>` | `examples/team-os/skills` | A folder of skill folders, each with a `SKILL.md`. |
| `--cases <file>` | `examples/team-os/cases.json` | The cases to run. |
| `--repeats <n>` | `1` | How many times each case runs. Two or more measure the noise floor. |
| `--out <dir>` | `results` | Where the output goes: `report.md` with the scores, `answers.md` with each request, its check results and the model's answer, and `rows.json` with the same data for code. |
| `RECORDINGS_DIR` | `recordings` | Where the eval reads and writes recordings. |
| `MODEL_LABEL` | `claude-sonnet-5` | The model id passed to `claude --model`. It is part of every recording key. If Claude Code answers with a different model, the run stops. |
| `JUDGE_MODEL` | `claude-opus-5` | The model that grades judge checks. Pinned across runs, so changing `MODEL_LABEL` to test a new generation moves only the model under test, not the grader. |

The skill loader reads single-line `name` and `description` fields from the front matter. It does not support multi-line YAML values.

To compare runs, pass their output folders to `compare.ts`. It prints one table row per run with the selection rate, the adherence rate and the noise floor.

```bash
node compare.ts runs/claude-sonnet-5 runs/another-model
```

To check the judge against a person, run `rate.ts` on a run folder. It shows each scored output in random order, without the eval's verdict, and asks whether you would use it if a teammate gave it to you for that request. You rate the whole answer; lines inside it such as a gate's "NOT PASSED" are the model's work, not the eval's verdict. It writes your answers to `ratings.json` and prints how many of your ratings the eval agreed with.

```bash
node rate.ts runs/claude-sonnet-5
```

## Writing cases

A case file is a JSON array of cases. The shapes are in `src/cases.ts`:

```ts
type Check =
  | { label: string; kind: 'contains' | 'absent' | 'regex'; value: string }
  | { label: string; kind: 'judge'; criterion: string };

type Case = {
  id: string;
  request: string;
  expectSkill: string | null;
  checks: Check[];
  origin: 'designed' | 'reported-issue';
  issue?: string;
};
```

Before any model call, the eval validates the file. It exits 1 if two cases share an id, if a case expects a skill the folder does not have, or if a case that expects a skill has no checks.

A none case sets `expectSkill` to `null` and has no checks. It scores selection only, and the model passes by choosing no skill.

```json
{ "id": "none-1", "origin": "designed", "expectSkill": null, "request": "What's the capital of Australia?", "checks": [] }
```

A string check runs on the output without a model. `contains` passes when the value appears and `absent` passes when it does not, both ignoring case. `regex` ignores case, and its `.` matches newlines.

```json
{ "label": "names a measure", "kind": "contains", "value": "Measure" }
```

A judge check is a criterion in plain English. The eval sends all of a case's judge criteria to the model in one call, with the request, the output and the rubric in `RUBRIC.md`. The rubric tells the judge to answer PASS or FAIL for each criterion and to fail when unsure. The report prints the first 12 characters of the rubric's SHA-256, so every report shows which rubric scored it. If the judge's answer does not parse, every judge check on that case fails.

```json
{ "label": "asks for the missing outcome", "kind": "judge", "criterion": "Because the request gives no outcome or measure, the work asks the user for them instead of inventing a full spec." }
```

A case counts as adherent only when every check passes.

When someone reports that a skill misbehaved, turn the report into a case. `caseFromIssue` in `src/cases.ts` sets `origin` to `"reported-issue"` and keeps the report's text in `issue`. Each row in `rows.json` carries the origin, so you can count reported issues apart from designed cases. Commit the case before you change the skill, so a run on the old skill can show the failure.

The example below is hypothetical. It is not a case in this repository's set.

```json
{ "id": "spec-4", "origin": "reported-issue", "issue": "It wrote a spec with no measure.",
  "expectSkill": "spec", "request": "Write the spec for archiving stale projects.",
  "checks": [{ "label": "names a measure", "kind": "contains", "value": "Measure" }] }
```

The example set in `examples/team-os/` has seven skills, copied from the `team-os` repository at commit `845f0b5`, and 16 cases. Thirteen expect a skill and three expect none. All 16 are designed cases. None came from a reported issue.

## Results

Two generations of the same model family ran the same 7 skills and 16 cases, 3 repeats each, on 23 Sep 2026. `claude-opus-5` judged both.

| Run | Selection | Adherence | Noise floor |
| --- | --- | --- | --- |
| claude-sonnet-4-6 | 96% | 72% | 15 points |
| claude-sonnet-5 | 98% | 74% | 15 points |

The adherence difference is 2 points, below the 15-point noise floor. This run is not evidence that either generation follows these skills better.

Both generations did worst on the same two skills: `security-review-gate`, 33% and 17% adherent, and `spec`, 56% for each. One check failed in every repeat for both: asked for the security review of a bot that posts public status updates, both wrote the full review instead of a short one proportionate to the risk.

Each run's `report.md` and `answers.md` are in `runs/`. `answers.md` shows every request, its check results and the answer.

One judge call was refused by the judge model's safety filter on the first attempt and passed when run again. No person has rated these outputs with `rate.ts` yet, so the judge's agreement with a person is not measured.

The cases and the skills snapshot have not changed since commit `b744e1e`, which came before any run.

## What this does not prove

- The same person wrote the skills and the cases. A second author would write harder cases.
- There are 16 cases. Thirteen score adherence, one to three per skill, which is too few to rank the skills against each other.
- A model judges some checks. The judge model is pinned (`JUDGE_MODEL`, default `claude-opus-5`) separately from the model under test, and the eval pins the rubric by hash, but a judge is not a person. `rate.ts` measures how often a person agrees with it.
- The selection prompt approximates how an agent finds skills. It lists each skill's name and description and asks for one line back. It is not Claude Code's own prompt or any other product's.
- Claude Code adds a few hundred tokens of its own context to each call, even in safe mode. The eval cannot remove it, so the model sees slightly more than the eval's prompt. That context includes the date, the working directory and the logged-in email. An answer can quote the email or the company it implies, so before live mode saves an answer or passes it to the judge, it replaces the email with `<user email>` and the organization name from `claude auth status` with `<user org>`.
- Claude Code sets the output token limit. An answer that goes past it stops the run with an error; it is never scored.
- The model runs at its default temperature, which `claude -p` does not let the eval set, so each repeat samples again. The noise floor measures the spread across repeats, and three repeats is a small sample of it.
- Thinking is off on every call.
- Adherence runs as one turn with no tools. The prompt tells the model to print a file's contents where the skill says to write the file. An agent with tools may behave differently.

## Run the tests

```bash
node --test test/*.test.ts
```

The tests need Node 24, which runs TypeScript directly. There are no dependencies and no build step, and the tests make no model calls.
