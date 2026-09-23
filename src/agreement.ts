import type { Row } from './report.ts';

export type Rating = { caseId: string; repeat: number; rating: 'up' | 'down' };

export function agreement(rows: Row[], ratings: Rating[]): { n: number; up: number; agree: number } {
  let n = 0, up = 0, agree = 0;
  for (const rt of ratings) {
    const row = rows.find((r) => r.caseId === rt.caseId && r.repeat === rt.repeat && r.adherent !== null);
    if (!row) continue;
    n++;
    if (rt.rating === 'up') up++;
    if (row.adherent === (rt.rating === 'up')) agree++;
  }
  return { n, up, agree };
}
