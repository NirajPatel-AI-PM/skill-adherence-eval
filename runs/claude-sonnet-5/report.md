# Skill adherence: results

Mode: live. Model: claude-sonnet-5. Judge: claude-opus-5. Rubric: `a29ff0241604`. Skills: examples/team-os/skills.
16 cases, 3 repeats, 48 rows.

## Totals

- Selection: 47 of 48 correct (98%).
- Adherence: 29 of 39 passed every check (74%).
- Noise floor: 15 points, the spread of the adherence rate between repeats. A smaller difference is not evidence.

## Adherence by skill

| Skill | Adherent | Of | Rate |
| --- | --- | --- | --- |
| design-brief | 3 | 3 | 100% |
| outcome-roadmap | 5 | 6 | 83% |
| release-gate | 3 | 3 | 100% |
| review | 6 | 6 | 100% |
| rice | 6 | 6 | 100% |
| security-review-gate | 1 | 6 | 17% |
| spec | 5 | 9 | 56% |

## Checks that failed most

- proportionate: 3
- asks for the missing outcome: 2
- does not self-approve: 2
- measure has a baseline and a target: 2
- groups by outcome: 1

## Selection misses

- review-2 (repeat 1): expected review, got none

## What these numbers do not mean

- The cases and the skills have the same author. A second author would write harder cases.
- A language model judges some checks. The rubric is pinned by hash, but a judge is not a person.
- The selection prompt approximates how an agent finds skills. It is not any product's own prompt.
