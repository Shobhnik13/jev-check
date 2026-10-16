import {createReadStream} from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Readable} from 'node:stream';
import type {ReadableStream as WebReadableStream} from 'node:stream/web';

import {get, put} from '@vercel/blob';

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

// Photos go to a private Vercel Blob store when one is connected, otherwise to the local disk.
const useBlob = Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);

export async function writeUpload(relativePath: string, buffer: Buffer) {
  if (useBlob) {
    await put(relativePath, buffer, {access: 'private', contentType: 'image/jpeg', addRandomSuffix: false, allowOverwrite: true});
    return;
  }

  let fullPath = _resolve(relativePath);
  await fs.mkdir(path.dirname(fullPath), {recursive: true});
  await fs.writeFile(fullPath, buffer);
}

export async function readUpload(relativePath: string): Promise<Buffer> {
  if (useBlob) {
    let file = await _blob(relativePath);
    return Buffer.from(await new Response(file.stream).arrayBuffer());
  }

  return fs.readFile(_resolve(relativePath));
}

export async function openUpload(relativePath: string): Promise<Readable | null> {
  try {
    if (useBlob) {
      return Readable.fromWeb((await _blob(relativePath)).stream as WebReadableStream);
    }

    let fullPath = _resolve(relativePath);
    await fs.access(fullPath);
    return createReadStream(fullPath);
  } catch {
    return null;
  }
}

async function _blob(relativePath: string) {
  let file = await get(relativePath, {access: 'private'});

  if (!file || file.statusCode !== 200) {
    throw new AppError('entity_missing', 'file');
  }

  return file;
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
