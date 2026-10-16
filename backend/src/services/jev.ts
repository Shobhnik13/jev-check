import {randomUUID} from 'node:crypto';

import {config} from '@/configs/config';
import {AppError} from '@/configs/status';

import type {Box} from '@/services/types';

export type Question =
  | {type: 'noul'; instructions: string; criteria?: {true: string; false: string}}
  | {type: 'box'; instructions: string}
  | {type: 'choice'; instructions: string; criteria: Record<string, string | null>};

export type Answer =
  | {type: 'noul'; noul: number}
  | {type: 'box'; box: Box; confidence: number}
  | {type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number>};

export type JevReply = {answers: Record<string, Answer>; latency_ms: number; input_tokens: number; model: string};

type Asset = {type: 'image'; data_base64: string; format: 'jpeg'};

// Images are passed as references: the photo goes into state, reference crops are named inside question text.
export class Images {
  assets: Record<string, Asset> = {};

  add(buffer: Buffer): string {
    let ref = randomUUID();
    this.assets[ref] = {type: 'image', data_base64: buffer.toString('base64'), format: 'jpeg'};
    return ref;
  }
}

export async function ask(params: {photo: string; images: Images; questions: Record<string, Question>}): Promise<JevReply> {
  if (config.JEV.MOCK) {
    return _mock(params.questions);
  }

  if (!config.JEV.KEY) {
    throw new AppError('jev_key_missing');
  }

  let startedAt = Date.now();
  let response: Response;

  try {
    response = await fetch(config.JEV.URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.JEV.KEY}`,
        'Content-Type': 'application/json',
        'TypeSafe-Danger-Zone-Images': 'true',
      },
      body: JSON.stringify({model: config.JEV.MODEL, state: {photo: params.photo}, assets: params.images.assets, questions: params.questions}),
      signal: AbortSignal.timeout(config.JEV.TIMEOUT_MS),
    });
  } catch (err) {
    throw new AppError('jev_fail', err instanceof Error ? err.message : String(err));
  }

  if (!response.ok) {
    let text = await response.text().catch(() => '');
    throw new AppError(response.status === 400 || response.status === 413 ? 'jev_rejected' : 'jev_fail', `${response.status} ${text.slice(0, 300)}`);
  }

  let result = (await response.json()) as {model: string; answers: Record<string, Answer>; usage?: {input_tokens?: number}};

  for (let [key, question] of Object.entries(params.questions)) {
    if (result.answers?.[key]?.type !== question.type) {
      throw new AppError('jev_fail', `missing ${question.type} answer for ${key}`);
    }
  }

  return {answers: result.answers, latency_ms: Date.now() - startedAt, input_tokens: result.usage?.input_tokens ?? 0, model: result.model};
}

export function noul(reply: JevReply, key: string): number {
  return (reply.answers[key] as Extract<Answer, {type: 'noul'}>).noul;
}

export function box(reply: JevReply, key: string): {box: Box; confidence: number} {
  let answer = reply.answers[key] as Extract<Answer, {type: 'box'}>;
  return {box: answer.box, confidence: answer.confidence ?? 0};
}

export function choice(reply: JevReply, key: string) {
  return reply.answers[key] as Extract<Answer, {type: 'choice'}>;
}

// Plausible fake answers that drift over time, so the UI can be exercised without a key.
async function _mock(questions: Record<string, Question>): Promise<JevReply> {
  let latencyMs = 180 + Math.round(Math.random() * 220);
  await new Promise((resolve) => setTimeout(resolve, latencyMs));

  let t = Date.now() / 1000;
  let answers: Record<string, Answer> = {};
  let i = 0;

  for (let [key, question] of Object.entries(questions)) {
    let wobble = Math.abs(Math.sin(t / 2 + i++));

    if (question.type === 'noul') {
      answers[key] = {type: 'noul', noul: 0.55 + 0.44 * wobble};
    } else if (question.type === 'box') {
      let cx = 0.5 + 0.2 * Math.sin(t / 3 + i);
      let cy = 0.5 + 0.15 * Math.cos(t / 4 + i);
      answers[key] = {type: 'box', box: {top: cy - 0.15, bottom: cy + 0.15, left: cx - 0.12, right: cx + 0.12}, confidence: 0.6 + 0.35 * wobble};
    } else {
      let names = Object.keys(question.criteria);
      let probabilities = Object.fromEntries(names.map((name, n) => [name, n === 0 ? 0.5 + 0.4 * wobble : (0.5 - 0.4 * wobble) / Math.max(1, names.length - 1)]));
      answers[key] = {type: 'choice', choice: names[0], confidence: wobble, probabilities};
    }
  }

  return {answers, latency_ms: latencyMs, input_tokens: 900 * Object.keys(questions).length, model: 'mock'};
}
