import {db} from '@/configs/config';
import {AppError} from '@/configs/status';

export type Session = {id: number; owner_id: number; last_seen_at: Date};

export type DeviceLink = {id: number; owner_id: number; code: string; expires_at: Date};

export async function createOwner(): Promise<number> {
  let result = await db('owners').insert({}).returning('id');
  return result[0].id;
}

export async function createSession(params: {ownerId: number; tokenHash: string; userAgent?: string | null}): Promise<number> {
  if (!params.ownerId || !params.tokenHash) {
    throw new AppError('input_missing');
  }

  let result = await db('sessions')
    .insert({owner_id: params.ownerId, token_hash: params.tokenHash, user_agent: params.userAgent?.slice(0, 300) ?? null})
    .returning('id');
  return result[0].id;
}

export async function getSession(params: {tokenHash: string}): Promise<Session | null> {
  if (!params.tokenHash) {
    throw new AppError('input_missing');
  }

  let row = await db('sessions as s')
    .join('owners as o', {'o.id': 's.owner_id'})
    .select('s.id', 's.owner_id', 's.last_seen_at')
    .where({'s.token_hash': params.tokenHash, 's.active': true, 'o.active': true})
    .first();

  return row ?? null;
}

export async function updateSession(params: {sessionId: number; lastSeenAt: Date}) {
  if (!params.sessionId) {
    throw new AppError('input_missing');
  }

  await db('sessions').where('id', params.sessionId).update({last_seen_at: params.lastSeenAt, updated_at: new Date().toISOString()});
}

export async function createLink(params: {ownerId: number; code: string; expiresAt: Date}): Promise<number> {
  if (!params.ownerId || !params.code) {
    throw new AppError('input_missing');
  }

  let result = await db('device_links').insert({owner_id: params.ownerId, code: params.code, expires_at: params.expiresAt}).returning('id');
  return result[0].id;
}

// Only unused, unexpired codes count.
export async function getLink(params: {code: string}): Promise<DeviceLink | null> {
  if (!params.code) {
    throw new AppError('input_missing');
  }

  let row = await db('device_links as l')
    .select('l.id', 'l.owner_id', 'l.code', 'l.expires_at')
    .where({'l.code': params.code, 'l.active': true})
    .whereNull('l.used_at')
    .where('l.expires_at', '>', new Date())
    .orderBy('l.id', 'desc')
    .first();

  return row ?? null;
}

export async function updateLink(params: {linkId: number; usedAt: Date}) {
  if (!params.linkId) {
    throw new AppError('input_missing');
  }

  await db('device_links').where('id', params.linkId).update({used_at: params.usedAt, updated_at: new Date().toISOString()});
}
