import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type Message = { role: 'user' | 'assistant'; content: string };
export type Request = { system: string; messages: Message[]; model?: string };
export type Mode = 'live' | 'replay';

export const recordingsDir = () => process.env.RECORDINGS_DIR ?? 'recordings';
export const MODEL_LABEL = process.env.MODEL_LABEL ?? 'claude-sonnet-5';
export const JUDGE_MODEL = process.env.JUDGE_MODEL ?? 'claude-opus-5';
export type ModelResponse = { text: string };

let repeat = 0;
export function setRepeat(n: number): void {
  repeat = n;
}

// The whole request is the key, and req.model overrides MODEL_LABEL so judge keys ignore the model under test.
export function keyOf(req: Request): string {
  const body = { model: MODEL_LABEL, thinking: 'disabled', ...req, ...(repeat ? { repeat } : {}) };
  return createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 32);
}

export class MissingRecording extends Error {
  constructor(key: string) {
    super(`no recording for request ${key}. This harness never invents a model response. Run live while logged in to Claude Code, or replay a run that happened.`);
    this.name = 'MissingRecording';
  }
}

export async function callModel(req: Request, mode: Mode): Promise<ModelResponse> {
  const key = keyOf(req);
  const path = join(recordingsDir(), `${key}.json`);
  if (existsSync(path)) {
    const rec = JSON.parse(readFileSync(path, 'utf8'));
    return { text: rec.response };
  }
  if (mode === 'replay') throw new MissingRecording(key);

  const model = req.model ?? MODEL_LABEL;
  if (req.messages.length !== 1 || req.messages[0].role !== 'user') throw new Error('live mode sends exactly one user message');
  // Safe mode and no tools keep the caller's skills, plugins, hooks and CLAUDE.md out of the request.
  const args = ['-p', '--safe-mode', '--tools', '', '--system-prompt', req.system, '--model', model, '--output-format', 'json', '--no-session-persistence', '--settings', '{"alwaysThinkingEnabled":false}'];
  const out = execFileSync('claude', args, { input: req.messages[0].content, cwd: tmpdir(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const body = JSON.parse(out) as { is_error: boolean; result: string; stop_reason: string; modelUsage?: Record<string, unknown> };
  if (body.is_error) throw new Error(`model call failed for request ${key}: ${body.result}`);
  if (!body.modelUsage?.[model]) throw new Error(`asked for ${model}, Claude Code answered with ${Object.keys(body.modelUsage ?? {}).join(', ')}`);
  if (!body.result) throw new Error(`empty response for request ${key}, stop_reason ${body.stop_reason}`);

  mkdirSync(recordingsDir(), { recursive: true });
  writeFileSync(path, JSON.stringify({ model, thinking: 'disabled', repeat, stop_reason: body.stop_reason, request: req, response: body.result }, null, 2) + '\n');
  return { text: body.result };
}
