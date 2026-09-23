import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Message = { role: 'user' | 'assistant'; content: string };
export type Request = { system: string; messages: Message[]; maxTokens: number; model?: string };
export type Mode = 'live' | 'replay';

export const recordingsDir = () => process.env.RECORDINGS_DIR ?? 'recordings';
export const MODEL_LABEL = process.env.MODEL_LABEL ?? 'claude-sonnet-5';
export const JUDGE_MODEL = process.env.JUDGE_MODEL ?? 'claude-opus-5';
export const TEMPERATURE = parseTemperature(process.env.TEMPERATURE);

function parseTemperature(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`TEMPERATURE must be a number, got "${value}"`);
  return n;
}

// Only judge requests set req.model, and the judge always runs at its default temperature.
const temperatureFor = (req: Request) => (req.model ? undefined : TEMPERATURE);

export type ModelResponse = { text: string; stopReason: string };

let repeat = 0;
export function setRepeat(n: number): void {
  repeat = n;
}

// The whole request is the key, and req.model overrides MODEL_LABEL so judge keys ignore the model under test.
export function keyOf(req: Request): string {
  const body = { model: MODEL_LABEL, temperature: temperatureFor(req) ?? 'default', thinking: 'disabled', ...req, ...(repeat ? { repeat } : {}) };
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

export async function callModel(req: Request, mode: Mode): Promise<ModelResponse> {
  const key = keyOf(req);
  const path = join(recordingsDir(), `${key}.json`);
  if (existsSync(path)) {
    const rec = JSON.parse(readFileSync(path, 'utf8'));
    return { text: rec.response, stopReason: rec.stop_reason };
  }
  if (mode === 'replay') throw new MissingRecording(key);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('live mode needs ANTHROPIC_API_KEY');
  const model = req.model ?? MODEL_LABEL;
  const temperature = temperatureFor(req);
  const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens,
      ...(temperature !== undefined ? { temperature } : {}),
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
    JSON.stringify({ model, temperature: temperature ?? 'default', thinking: 'disabled', repeat, stop_reason: body.stop_reason, request: req, response }, null, 2) + '\n',
  );
  return { text: response, stopReason: body.stop_reason };
}
