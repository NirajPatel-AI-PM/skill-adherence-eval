import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Message = { role: 'user' | 'assistant'; content: string };
export type Request = { system: string; messages: Message[]; maxTokens: number };
export type Mode = 'live' | 'replay';

export const recordingsDir = () => process.env.RECORDINGS_DIR ?? 'recordings';
export const MODEL_LABEL = process.env.MODEL_LABEL ?? 'claude-sonnet-5';
export const TEMPERATURE = Number(process.env.TEMPERATURE ?? 1);

let repeat = 0;
export function setRepeat(n: number): void {
  repeat = n;
}

// The whole request is the key, so an edited skill can never reuse an old answer.
export function keyOf(req: Request): string {
  const body = { model: MODEL_LABEL, temperature: TEMPERATURE, ...req, ...(repeat ? { repeat } : {}) };
  return createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 32);
}

export class MissingRecording extends Error {
  constructor(key: string) {
    super(`no recording for request ${key}. This harness never invents a model response. Run live with ANTHROPIC_API_KEY set, or replay a run that happened.`);
    this.name = 'MissingRecording';
  }
}

export async function callModel(req: Request, mode: Mode): Promise<string> {
  const path = join(recordingsDir(), `${keyOf(req)}.json`);
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')).response as string;
  if (mode === 'replay') throw new MissingRecording(keyOf(req));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('live mode needs ANTHROPIC_API_KEY');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL_LABEL, max_tokens: req.maxTokens, temperature: TEMPERATURE, system: req.system, messages: req.messages }),
  });
  if (!res.ok) throw new Error(`model call failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  const response = body.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');

  mkdirSync(recordingsDir(), { recursive: true });
  writeFileSync(path, JSON.stringify({ model: MODEL_LABEL, temperature: TEMPERATURE, repeat, request: req, response }, null, 2) + '\n');
  return response;
}
