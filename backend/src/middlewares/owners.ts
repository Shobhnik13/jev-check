import type {NextFunction, Request, Response} from 'express';

import {config} from '@/configs/config';

import * as ownersService from '@/services/owners';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      owner: {id: number; sessionId: number};
    }
  }
}

const {COOKIE, COOKIE_MAX_AGE_S} = config.OWNERS;

// Every request belongs to an anonymous owner, identified by a random token in an httpOnly cookie.
export async function owners(req: Request, res: Response, next: NextFunction) {
  let resolved = await ownersService.resolveOwner({token: readCookie(req, COOKIE), userAgent: req.get('user-agent'), ip: clientIp(req)});
  req.owner = {id: resolved.ownerId, sessionId: resolved.sessionId};
  resolved.token ? setOwnerCookie(req, res, resolved.token) : null;
  next();
}

export function setOwnerCookie(req: Request, res: Response, token: string) {
  let secure = req.secure || req.get('x-forwarded-proto') === 'https' || process.env.NODE_ENV === 'production';
  res.append('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_S}${secure ? '; Secure' : ''}`);
}

function readCookie(req: Request, name: string): string | undefined {
  for (let part of (req.get('cookie') ?? '').split(';')) {
    let [key, ...rest] = part.trim().split('=');

    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return undefined;
}

function clientIp(req: Request) {
  return (req.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}
