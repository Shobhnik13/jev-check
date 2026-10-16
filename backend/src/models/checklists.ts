import {db} from '@/configs/config';
import {AppError} from '@/configs/status';

import type {ItemType, MatchMode, Option} from '@/services/types';

export type Item = {
  id: number;
  checklist_id: number;
  object_id: number | null;
  type: ItemType;
  question: string | null;
  options: Option[] | null;
  pass_options: string[] | null;
  expect_present: boolean;
  match: MatchMode;
  threshold: number;
  position: number;
};

export type Checklist = {
  id: number;
  name: string;
  description: string | null;
  webhook_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string | null;
  items: Item[];
};

export type ItemInput = Omit<Item, 'id' | 'checklist_id'> & {id?: number};

type ChecklistRow = Omit<Checklist, 'items'>;
type ItemRow = Omit<Item, 'options' | 'pass_options'> & {options: string | Option[] | null; pass_options: string | string[] | null};

export async function createChecklist(params: {ownerId: number; name: string; description?: string | null; webhookUrl?: string | null}): Promise<number> {
  if (!params.ownerId || !params.name) {
    throw new AppError('input_missing');
  }

  let result = await db('checklists').insert({owner_id: params.ownerId, name: params.name, description: params.description ?? null, webhook_url: params.webhookUrl ?? null}).returning('id');
  return result[0].id;
}

export async function getChecklists(params: {ownerId: number; checklistIds?: number[]; active?: boolean}): Promise<Checklist[]> {
  if (!params.ownerId) {
    throw new AppError('input_missing');
  }

  let query = db('checklists as c').select('c.*').where('c.owner_id', params.ownerId);
  params.checklistIds ? query.whereIn('c.id', params.checklistIds) : null;
  Object.hasOwn(params, 'active') ? query.where('c.active', params.active ? true : false) : null;

  let rows: ChecklistRow[] = await query.orderBy('c.id', 'desc');
  let items: ItemRow[] = await db('checklist_items as i')
    .select('i.*')
    .whereIn(
      'i.checklist_id',
      rows.map((row) => row.id),
    )
    .where('i.active', true)
    .orderBy([{column: 'i.position'}, {column: 'i.id'}]);

  return _collate(rows, items);
}

export async function getChecklist(params: {ownerId: number; checklistId: number}): Promise<Checklist | null> {
  if (!params.ownerId || !params.checklistId) {
    throw new AppError('input_missing');
  }

  let result = await getChecklists({ownerId: params.ownerId, checklistIds: [params.checklistId]});
  return result[0] ?? null;
}

export async function updateChecklist(params: {checklistId: number; name?: string; description?: string | null; webhookUrl?: string | null; active?: boolean}) {
  if (!params.checklistId) {
    throw new AppError('input_missing');
  }

  let _update: Record<string, unknown> = {updated_at: new Date().toISOString()};
  params.name ? (_update.name = params.name) : null;
  Object.hasOwn(params, 'description') ? (_update.description = params.description) : null;
  Object.hasOwn(params, 'webhookUrl') ? (_update.webhook_url = params.webhookUrl) : null;
  Object.hasOwn(params, 'active') ? (_update.active = params.active ? true : false) : null;
  _update.active === false ? (_update.deleted_at = _update.updated_at) : null;

  await db('checklists').where('id', params.checklistId).update(_update);
}

// Items are versioned by soft delete: past runs keep pointing at the item they were judged against.
export async function replaceItems(params: {checklistId: number; items: ItemInput[]}) {
  if (!params.checklistId || !params.items) {
    throw new AppError('input_missing');
  }

  let now = new Date().toISOString();

  await db.transaction(async (trx) => {
    let keepIds = params.items.map((item) => item.id).filter((id): id is number => Boolean(id));
    await trx('checklist_items').where('checklist_id', params.checklistId).where('active', true).whereNotIn('id', keepIds).update({active: false, updated_at: now, deleted_at: now});

    for (let [position, item] of params.items.entries()) {
      let row = {
        object_id: item.object_id,
        type: item.type,
        question: item.question,
        options: item.options ? JSON.stringify(item.options) : null,
        pass_options: item.pass_options ? JSON.stringify(item.pass_options) : null,
        expect_present: Boolean(item.expect_present),
        match: item.match,
        threshold: item.threshold,
        position,
      };

      item.id ? await trx('checklist_items').where({id: item.id, checklist_id: params.checklistId}).update({...row, updated_at: now}) : await trx('checklist_items').insert({...row, checklist_id: params.checklistId});
    }
  });
}

function _collate(rows: ChecklistRow[], items: ItemRow[]): Checklist[] {
  return rows.map((row) => ({
    ...row,
    active: Boolean(row.active),
    items: items
      .filter((item) => item.checklist_id === row.id)
      .map((item) => ({
        ...item,
        options: typeof item.options === 'string' ? JSON.parse(item.options) : item.options,
        pass_options: typeof item.pass_options === 'string' ? JSON.parse(item.pass_options) : item.pass_options,
        threshold: Number(item.threshold),
      })),
  }));
}
