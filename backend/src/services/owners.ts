import {createHash, randomBytes, randomInt} from 'node:crypto';

import {config} from '@/configs/config';
import {AppError} from '@/configs/status';

import * as limitsService from '@/services/limits';

import * as ownersModel from '@/models/owners';

const {CACHE_TTL_MS, SEEN_EVERY_MS, LINK_TTL_MS} = config.OWNERS;

type Resolved = {ownerId: number; sessionId: number; token?: string};

// Tokens are looked up on every frame in live mode, so recent lookups are cached briefly.
const sessions = new Map<string, {session: ownersModel.Session; expiresAt: number}>();

// Finds the owner behind a cookie token, or creates a fresh anonymous owner and returns its new token.
export async function resolveOwner(params: {token?: string; userAgent?: string; ip: string}): Promise<Resolved> {
  if (params.token) {
    let tokenHash = _hash(params.token);
    let session = await _session(tokenHash);

    if (session) {
      return {ownerId: session.owner_id, sessionId: session.id};
    }
  }

  limitsService.spendNewOwner({ip: params.ip});

  let ownerId = await ownersModel.createOwner();
  return _startSession({ownerId, userAgent: params.userAgent});
}

export async function createLink(params: {ownerId: number}) {
  if (!params.ownerId) {
    throw new AppError('input_missing');
  }

  let code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  let expiresAt = new Date(Date.now() + LINK_TTL_MS);
  await ownersModel.createLink({ownerId: params.ownerId, code, expiresAt});

  return {code, expires_at: expiresAt.toISOString()};
}

// A code from another device moves this browser onto that device's owner. Codes work once.
export async function claimLink(params: {code?: string; userAgent?: string}): Promise<Resolved> {
  let code = (params.code ?? '').replace(/\D/g, '');

  if (code.length !== 6) {
    throw new AppError('link_invalid');
  }

  let link = await ownersModel.getLink({code});

  if (!link) {
    throw new AppError('link_invalid');
  }

  await ownersModel.updateLink({linkId: link.id, usedAt: new Date()});
  return _startSession({ownerId: link.owner_id, userAgent: params.userAgent});
}

async function _startSession(params: {ownerId: number; userAgent?: string}): Promise<Resolved> {
  let token = randomBytes(32).toString('base64url');
  let sessionId = await ownersModel.createSession({ownerId: params.ownerId, tokenHash: _hash(token), userAgent: params.userAgent});
  return {ownerId: params.ownerId, sessionId, token};
}

async function _session(tokenHash: string) {
  let now = Date.now();
  let cached = sessions.get(tokenHash);

  if (cached && cached.expiresAt > now) {
    return cached.session;
  }

  let session = await ownersModel.getSession({tokenHash});

  if (!session) {
    sessions.delete(tokenHash);
    return null;
  }

  if (now - new Date(session.last_seen_at).getTime() > SEEN_EVERY_MS) {
    session.last_seen_at = new Date(now);
    await ownersModel.updateSession({sessionId: session.id, lastSeenAt: session.last_seen_at});
  }

  sessions.size > 10_000 ? sessions.clear() : null;
  sessions.set(tokenHash, {session, expiresAt: now + CACHE_TTL_MS});
  return session;
}

function _hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
