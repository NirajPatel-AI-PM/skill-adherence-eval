import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Message = { role: 'user' | 'assistant'; content: string };
export type Request = { system: string; messages: Message[]; maxTokens: number; model?: string };
export type Mode = 'live' | 'replay';

export const recordingsDir = () => process.env.RECORDINGS_DIR ?? 'recordings';
export const MODEL_LABEL = process.env.MODEL_LABEL ?? 'claude-sonnet-5';
export const JUDGE_MODEL = process.env.JUDGE_MODEL ?? 'claude-opus-5';
export const TEMPERATURE: number | undefined = process.env.TEMPERATURE ? Number(process.env.TEMPERATURE) : undefined;

let repeat = 0;
export function setRepeat(n: number): void {
  repeat = n;
}

// The whole request is the key, so an edited skill can never reuse an old answer.
// req.model overrides the model field, so a judge request's key never depends on MODEL_LABEL.
export function keyOf(req: Request): string {
  const body = { model: MODEL_LABEL, temperature: TEMPERATURE ?? 'default', thinking: 'disabled', ...req, ...(repeat ? { repeat } : {}) };
  return createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 32);
}

export class MissingRecording extends Error {
  constructor(key: string) {
    super(`no recording for request ${key}. This harness never invents a model response. Run live with ANTHROPIC_API_KEY set, or replay a run that happened.`);
    this.name = 'MissingRecording';
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 3) return res;
    await sleep(1000 * 2 ** attempt);
  }
}

export async function callModel(req: Request, mode: Mode): Promise<string> {
  const key = keyOf(req);
  const path = join(recordingsDir(), `${key}.json`);
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')).response as string;
  if (mode === 'replay') throw new MissingRecording(key);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('live mode needs ANTHROPIC_API_KEY');
  const model = req.model ?? MODEL_LABEL;
  const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens,
      ...(TEMPERATURE !== undefined ? { temperature: TEMPERATURE } : {}),
      thinking: { type: 'disabled' },
      system: req.system,
      messages: req.messages,
    }),
  });
  if (!res.ok) throw new Error(`model call failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { content: Array<{ type: string; text?: string }>; stop_reason: string };
  const response = body.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
  if (!response) throw new Error(`empty response for request ${key}, stop_reason ${body.stop_reason}`);

  mkdirSync(recordingsDir(), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({ model, temperature: TEMPERATURE ?? 'default', thinking: 'disabled', repeat, stop_reason: body.stop_reason, request: req, response }, null, 2) + '\n',
  );
  return response;
}
