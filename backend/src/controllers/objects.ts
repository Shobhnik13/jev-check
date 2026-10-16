import type {Request, Response} from 'express';

import {AppError, success} from '@/configs/status';

import * as objectsService from '@/services/objects';
import * as utilsService from '@/services/utils';

export async function createObject(req: Request, res: Response) {
  if (!req.body?.label) {
    throw new AppError('input_missing', 'label');
  }

  let label = String(req.body.label).trim();
  let objectParams = {ownerId: req.owner.id, name: String(req.body.name || label).trim(), label};

  let result = await objectsService.createObject(objectParams);
  res.json(success('object', result));
}

export async function getObjects(req: Request, res: Response) {
  let result = await objectsService.getObjects({ownerId: req.owner.id});
  res.json(success('objects', result));
}

export async function getObject(req: Request, res: Response) {
  let objectParams = {ownerId: req.owner.id, objectId: parseInt(req.params.object_id as string)};

  let result = await objectsService.getObject(objectParams);
  res.json(success('object', result));
}

export async function updateObject(req: Request, res: Response) {
  let body = req.body ?? {};
  let objectParams: Parameters<typeof objectsService.updateObject>[0] = {ownerId: req.owner.id, objectId: parseInt(req.params.object_id as string)};
  body.name ? (objectParams.name = String(body.name).trim()) : null;
  body.label ? (objectParams.label = String(body.label).trim()) : null;
  Object.hasOwn(body, 'active') ? (objectParams.active = Boolean(Number(body.active))) : null;

  let result = await objectsService.updateObject(objectParams);
  res.json(success('object', result));
}

export async function createReference(req: Request, res: Response) {
  if (!req.file || !req.body?.object_id) {
    throw new AppError('input_missing', 'image and object_id');
  }

  let referenceParams: Parameters<typeof objectsService.createReference>[0] = {ownerId: req.owner.id, objectId: parseInt(req.body.object_id), image: req.file.buffer};
  req.body.box ? (referenceParams.box = utilsService.parseBox(req.body.box)) : null;

  let result = await objectsService.createReference(referenceParams);
  res.json(success('reference', result));
}

export async function updateReference(req: Request, res: Response) {
  let body = req.body ?? {};
  let referenceParams: Parameters<typeof objectsService.updateReference>[0] = {ownerId: req.owner.id, referenceId: parseInt(req.params.reference_id as string)};
  body.box ? (referenceParams.box = utilsService.parseBox(body.box)) : null;
  Object.hasOwn(body, 'active') ? (referenceParams.active = Boolean(Number(body.active))) : null;

  let result = await objectsService.updateReference(referenceParams);
  res.json(success('reference', result));
}
