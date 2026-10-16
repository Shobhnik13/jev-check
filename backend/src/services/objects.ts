import {AppError} from '@/configs/status';

import * as imagesService from '@/services/images';
import * as jevService from '@/services/jev';
import * as limitsService from '@/services/limits';
import * as utilsService from '@/services/utils';

import * as objectsModel from '@/models/objects';

import type {Box} from '@/services/types';

export async function createObject(params: {ownerId: number; name?: string; label?: string}) {
  if (!params.ownerId || !params.name || !params.label) {
    throw new AppError('input_missing');
  }

  let objectId = await objectsModel.createObject({ownerId: params.ownerId, name: params.name, label: params.label});
  return getObject({ownerId: params.ownerId, objectId});
}

export async function getObjects(params: {ownerId: number}) {
  return objectsModel.getObjects({ownerId: params.ownerId, active: true});
}

export async function getObject(params: {ownerId: number; objectId: number}) {
  let object = await objectsModel.getObject(params);

  if (!object || !object.active) {
    throw new AppError('entity_missing', 'item');
  }

  return object;
}

export async function updateObject(params: {ownerId: number; objectId: number; name?: string; label?: string; active?: boolean}) {
  await getObject({ownerId: params.ownerId, objectId: params.objectId});

  let {ownerId, ...update} = params;
  await objectsModel.updateObject(update);
  return objectsModel.getObject({ownerId, objectId: params.objectId});
}

// Without a box, Jev proposes one; the person can correct it afterwards with updateReference.
export async function createReference(params: {ownerId: number; objectId: number; image?: Buffer; box?: Box}) {
  if (!params.ownerId || !params.objectId || !params.image) {
    throw new AppError('input_missing');
  }

  let object = await getObject({ownerId: params.ownerId, objectId: params.objectId});
  let img = await imagesService.normalize(params.image);
  let box = params.box;
  let located: {present: number; box_confidence: number; latency_ms: number} | null = null;

  if (!box) {
    limitsService.spendCheck({ownerId: params.ownerId});

    let images = new jevService.Images();
    let photo = images.add(img.buffer);
    let reply = await jevService.ask({
      photo,
      images,
      questions: {
        present: {type: 'noul', instructions: `Is there a ${object.label} in \`photo\`?`},
        box: {type: 'box', instructions: `the ${object.label} in \`photo\``},
      },
    });
    let answer = jevService.box(reply, 'box');
    box = answer.box;
    located = {present: jevService.noul(reply, 'present'), box_confidence: answer.confidence, latency_ms: reply.latency_ms};
  }

  let version = Date.now();
  let base = `${utilsService.ownerDir(params.ownerId)}/objects/${object.id}/reference-${version}`;
  let image = `${base}.jpg`;
  let crop = `${base}-crop.jpg`;
  await utilsService.writeUpload(image, img.buffer);
  await utilsService.writeUpload(crop, (await imagesService.crop(img, box)).buffer);

  let referenceId = await objectsModel.createReference({objectId: object.id, image, crop, box, width: img.width, height: img.height});
  let reference = await objectsModel.getReference({ownerId: params.ownerId, referenceId});

  return {...reference, located};
}

export async function updateReference(params: {ownerId: number; referenceId: number; box?: Box; active?: boolean}) {
  let reference = await objectsModel.getReference({ownerId: params.ownerId, referenceId: params.referenceId});

  if (!reference || !reference.active) {
    throw new AppError('entity_missing', 'photo');
  }

  let update: Parameters<typeof objectsModel.updateReference>[0] = {referenceId: reference.id};
  Object.hasOwn(params, 'active') ? (update.active = params.active) : null;

  if (params.box) {
    let img = await imagesService.normalize(await utilsService.readUpload(reference.image));
    update.box = params.box;
    update.crop = reference.image.replace(/\.jpg$/, `-crop-${Date.now()}.jpg`);
    await utilsService.writeUpload(update.crop, (await imagesService.crop(img, params.box)).buffer);
  }

  await objectsModel.updateReference(update);
  return objectsModel.getReference({ownerId: params.ownerId, referenceId: reference.id});
}
