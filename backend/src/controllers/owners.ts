import type {Request, Response} from 'express';

import {success} from '@/configs/status';

import * as ownersService from '@/services/owners';
import * as utilsService from '@/services/utils';

import {setOwnerCookie} from '@/middlewares/owners';

export async function createLink(req: Request, res: Response) {
  let result = await ownersService.createLink({ownerId: req.owner.id});
  res.json(success('link', result));
}

export async function claimLink(req: Request, res: Response) {
  let linkParams = {code: String(req.body?.code ?? ''), userAgent: req.get('user-agent')};

  let result = await ownersService.claimLink(linkParams);
  setOwnerCookie(req, res, result.token as string);
  res.json(success('link', {linked: true}));
}

// Files are only served to the owner whose folder they live in.
export async function getFile(req: Request, res: Response) {
  let relativePath = ([] as string[]).concat(req.params.path ?? []).join('/');

  if (!utilsService.ownsUpload(req.owner.id, relativePath)) {
    res.status(404).end();
    return;
  }

  let file = await utilsService.openUpload(relativePath);

  if (!file) {
    res.status(404).end();
    return;
  }

  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  file.on('error', () => res.destroy()).pipe(res);
}
