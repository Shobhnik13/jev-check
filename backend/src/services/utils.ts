import fs from 'node:fs/promises';
import path from 'node:path';

import {config} from '@/configs/config';
import {AppError} from '@/configs/status';

import type {Box} from '@/services/types';

export function parseBox(input: unknown): Box {
  let box = typeof input === 'string' ? _safeJson(input) : input;

  if (!box || typeof box !== 'object') {
    throw new AppError('input_invalid', 'box must be an object');
  }

  let {top, bottom, left, right} = box as Record<string, unknown>;
  let edges = [top, bottom, left, right].map(Number);

  if (edges.some((edge) => !Number.isFinite(edge))) {
    throw new AppError('input_invalid', 'box needs numeric top, bottom, left, right');
  }

  let [t, b, l, r] = edges.map((edge) => Math.min(1, Math.max(0, edge)));

  if (t >= b || l >= r) {
    throw new AppError('input_invalid', 'box needs top < bottom and left < right');
  }

  return {top: t, bottom: b, left: l, right: r};
}

// Every stored file lives under its owner's folder, which is how file access is checked.
export function ownerDir(ownerId: number) {
  return `owners/${ownerId}`;
}

export function ownsUpload(ownerId: number, relativePath: string) {
  return relativePath.startsWith(`${ownerDir(ownerId)}/`) && !relativePath.includes('..');
}

export function uploadPath(relativePath: string) {
  return _resolve(relativePath);
}

export async function writeUpload(relativePath: string, buffer: Buffer) {
  let fullPath = _resolve(relativePath);
  await fs.mkdir(path.dirname(fullPath), {recursive: true});
  await fs.writeFile(fullPath, buffer);
}

export async function readUpload(relativePath: string): Promise<Buffer> {
  return fs.readFile(_resolve(relativePath));
}

function _resolve(relativePath: string) {
  let fullPath = path.resolve(config.UPLOADS_DIR, relativePath);

  if (!fullPath.startsWith(config.UPLOADS_DIR + path.sep)) {
    throw new AppError('input_invalid', 'bad file path');
  }

  return fullPath;
}

function _safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
