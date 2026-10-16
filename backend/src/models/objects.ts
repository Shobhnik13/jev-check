import {db} from '@/configs/config';
import {AppError} from '@/configs/status';

import type {Box} from '@/services/types';

export type Reference = {
  id: number;
  object_id: number;
  image: string;
  crop: string;
  box: Box;
  width: number;
  height: number;
  active: boolean;
  created_at: string;
};

export type ObjectRecord = {
  id: number;
  name: string;
  label: string;
  active: boolean;
  created_at: string;
  updated_at: string | null;
  references: Reference[];
};

type ObjectRow = Omit<ObjectRecord, 'references'>;
type ReferenceRow = Omit<Reference, 'box'> & {box: string | Reference['box']};

export async function createObject(params: {ownerId: number; name: string; label: string}): Promise<number> {
  if (!params.ownerId || !params.name || !params.label) {
    throw new AppError('input_missing');
  }

  let result = await db('objects').insert({owner_id: params.ownerId, name: params.name, label: params.label}).returning('id');
  return result[0].id;
}

export async function getObjects(params: {ownerId: number; objectIds?: number[]; active?: boolean}): Promise<ObjectRecord[]> {
  if (!params.ownerId) {
    throw new AppError('input_missing');
  }

  let query = db('objects as o').select('o.*').where('o.owner_id', params.ownerId);
  params.objectIds ? query.whereIn('o.id', params.objectIds) : null;
  Object.hasOwn(params, 'active') ? query.where('o.active', params.active ? true : false) : null;

  let rows: ObjectRow[] = await query.orderBy('o.id', 'desc');
  let references = await getReferences({objectIds: rows.map((row) => row.id), active: true});
  return _collate(rows, references);
}

export async function getObject(params: {ownerId: number; objectId: number}): Promise<ObjectRecord | null> {
  if (!params.ownerId || !params.objectId) {
    throw new AppError('input_missing');
  }

  let result = await getObjects({ownerId: params.ownerId, objectIds: [params.objectId]});
  return result[0] ?? null;
}

export async function updateObject(params: {objectId: number; name?: string; label?: string; active?: boolean}) {
  if (!params.objectId) {
    throw new AppError('input_missing');
  }

  let _update: Record<string, unknown> = {updated_at: new Date().toISOString()};
  params.name ? (_update.name = params.name) : null;
  params.label ? (_update.label = params.label) : null;
  Object.hasOwn(params, 'active') ? (_update.active = params.active ? true : false) : null;
  _update.active === false ? (_update.deleted_at = _update.updated_at) : null;

  await db('objects').where('id', params.objectId).update(_update);
}

export async function createReference(params: {objectId: number; image: string; crop: string; box: Box; width: number; height: number}): Promise<number> {
  if (!params.objectId || !params.image || !params.crop || !params.box) {
    throw new AppError('input_missing');
  }

  let _insert = {object_id: params.objectId, image: params.image, crop: params.crop, box: JSON.stringify(params.box), width: params.width, height: params.height};
  let result = await db('object_references').insert(_insert).returning('id');
  return result[0].id;
}

export async function getReferences(params: {objectIds?: number[]; active?: boolean}): Promise<Reference[]> {
  let query = db('object_references as r').select('r.*');
  params.objectIds ? query.whereIn('r.object_id', params.objectIds) : null;
  Object.hasOwn(params, 'active') ? query.where('r.active', params.active ? true : false) : null;

  let rows: ReferenceRow[] = await query.orderBy('r.id', 'desc');
  return rows.map(_collateReference);
}

export async function getReference(params: {ownerId: number; referenceId: number}): Promise<Reference | null> {
  if (!params.ownerId || !params.referenceId) {
    throw new AppError('input_missing');
  }

  let row: ReferenceRow | undefined = await db('object_references as r').join('objects as o', {'o.id': 'r.object_id'}).select('r.*').where({'r.id': params.referenceId, 'o.owner_id': params.ownerId}).first();
  return row ? _collateReference(row) : null;
}

export async function updateReference(params: {referenceId: number; crop?: string; box?: Box; active?: boolean}) {
  if (!params.referenceId) {
    throw new AppError('input_missing');
  }

  let _update: Record<string, unknown> = {updated_at: new Date().toISOString()};
  params.crop ? (_update.crop = params.crop) : null;
  params.box ? (_update.box = JSON.stringify(params.box)) : null;
  Object.hasOwn(params, 'active') ? (_update.active = params.active ? true : false) : null;
  _update.active === false ? (_update.deleted_at = _update.updated_at) : null;

  await db('object_references').where('id', params.referenceId).update(_update);
}

function _collate(rows: ObjectRow[], references: Reference[]): ObjectRecord[] {
  return rows.map((row) => ({
    ...row,
    active: Boolean(row.active),
    references: references.filter((reference) => reference.object_id === row.id),
  }));
}

function _collateReference(row: ReferenceRow): Reference {
  return {...row, box: typeof row.box === 'string' ? JSON.parse(row.box) : row.box, active: Boolean(row.active)};
}
