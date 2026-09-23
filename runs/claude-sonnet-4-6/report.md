# Skill adherence: results

Mode: live. Model: claude-sonnet-4-6. Judge: claude-opus-5. Rubric: `a29ff0241604`. Skills: examples/team-os/skills.
16 cases, 3 repeats, 48 rows.

## Totals

- Selection: 46 of 48 correct (96%).
- Adherence: 28 of 39 passed every check (72%).
- Noise floor: 15 points, the spread of the adherence rate between repeats. A smaller difference is not evidence.

## Adherence by skill

| Skill | Adherent | Of | Rate |
| --- | --- | --- | --- |
| design-brief | 3 | 3 | 100% |
| outcome-roadmap | 6 | 6 | 100% |
| release-gate | 3 | 3 | 100% |
| review | 4 | 6 | 67% |
| rice | 5 | 6 | 83% |
| security-review-gate | 2 | 6 | 33% |
| spec | 5 | 9 | 56% |

## Checks that failed most

- measure has a baseline and a target: 3
- names risks: 3
- outcome is a behavior change, not a feature: 3
- proportionate: 3
- does not invent numbers: 1
- does not self-approve: 1
- finds the missing access check: 1
- gives a breaking input: 1
- privacy risk named: 1
- smallest version lists what is out: 1

## Selection misses

- none-1 (repeat 0): expected none, got no answer
- none-1 (repeat 1): expected none, got no answer

## What these numbers do not mean

- The cases and the skills have the same author. A second author would write harder cases.
- A language model judges some checks. The rubric is pinned by hash, but a judge is not a person.
- The selection prompt approximates how an agent finds skills. It is not any product's own prompt.
