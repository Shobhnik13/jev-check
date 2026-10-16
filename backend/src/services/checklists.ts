import {AppError} from '@/configs/status';

import * as checklistsModel from '@/models/checklists';
import * as objectsModel from '@/models/objects';
import * as runsModel from '@/models/runs';

import type {ItemInput} from '@/models/checklists';

const AGREEMENT_WINDOW = 500;

export async function createChecklist(params: {ownerId: number; name?: string; description?: string | null; webhookUrl?: string | null; items?: ItemInput[]}) {
  if (!params.ownerId || !params.name || !params.items) {
    throw new AppError('input_missing');
  }

  await _validateItems(params.ownerId, params.items);

  let checklistId = await checklistsModel.createChecklist({ownerId: params.ownerId, name: params.name, description: params.description, webhookUrl: params.webhookUrl});
  await checklistsModel.replaceItems({checklistId, items: params.items.map(({id: _id, ...item}) => item)});

  return getChecklist({ownerId: params.ownerId, checklistId});
}

export async function getChecklists(params: {ownerId: number}) {
  let checklists = await checklistsModel.getChecklists({ownerId: params.ownerId, active: true});
  let totals = await runsModel.getRunTotals({ownerId: params.ownerId, checklistIds: checklists.map((c) => c.id)});

  return checklists.map((checklist) => ({...checklist, stats: _stats(totals.filter((t) => t.checklist_id === checklist.id))}));
}

// Includes the objects the items point at, and how often people agreed with Jev on each item.
export async function getChecklist(params: {ownerId: number; checklistId: number; withStats?: boolean}) {
  let checklist = await checklistsModel.getChecklist({ownerId: params.ownerId, checklistId: params.checklistId});

  if (!checklist || !checklist.active) {
    throw new AppError('entity_missing', 'checklist');
  }

  let objectIds = [...new Set(checklist.items.map((item) => item.object_id).filter((id): id is number => Boolean(id)))];
  let objects = objectIds.length ? await objectsModel.getObjects({ownerId: params.ownerId, objectIds}) : [];

  if (params.withStats === false) {
    return {...checklist, objects, stats: null, agreement: null};
  }

  let totals = await runsModel.getRunTotals({ownerId: params.ownerId, checklistIds: [checklist.id]});
  let runs = await runsModel.getRuns({ownerId: params.ownerId, checklistId: checklist.id, active: true, limit: AGREEMENT_WINDOW});

  return {...checklist, objects, stats: _stats(totals), agreement: _agreement(checklist.items.map((item) => item.id), runs)};
}

export async function updateChecklist(params: {ownerId: number; checklistId: number; name?: string; description?: string | null; webhookUrl?: string | null; items?: ItemInput[]; active?: boolean}) {
  await getChecklist({ownerId: params.ownerId, checklistId: params.checklistId});

  if (params.items) {
    await _validateItems(params.ownerId, params.items);
  }

  let {items, ownerId, ...update} = params;
  await checklistsModel.updateChecklist(update);
  items ? await checklistsModel.replaceItems({checklistId: params.checklistId, items}) : null;

  return params.active === false ? checklistsModel.getChecklist({ownerId, checklistId: params.checklistId}) : getChecklist({ownerId, checklistId: params.checklistId});
}

async function _validateItems(ownerId: number, items: ItemInput[]) {
  if (!items.length) {
    throw new AppError('checklist_empty');
  }

  let objectIds = [...new Set(items.map((item) => item.object_id).filter((id): id is number => Boolean(id)))];
  let objects = objectIds.length ? await objectsModel.getObjects({ownerId, objectIds, active: true}) : [];

  for (let [n, item] of items.entries()) {
    let where = `item ${n + 1}`;

    if (item.object_id && !objects.some((o) => o.id === item.object_id)) {
      throw new AppError('input_invalid', `${where}: unknown object`);
    }

    if (item.type === 'present' && !item.object_id) {
      throw new AppError('input_invalid', `${where}: pick an object`);
    }

    if (item.type !== 'present' && !item.question) {
      throw new AppError('input_invalid', `${where}: write the question`);
    }

    if (item.type === 'state') {
      let names = (item.options ?? []).map((o) => o.name);

      if (names.length < 2 || new Set(names).size !== names.length) {
        throw new AppError('input_invalid', `${where}: needs at least two different answers`);
      }

      if (!item.pass_options?.length || item.pass_options.some((name) => !names.includes(name))) {
        throw new AppError('input_invalid', `${where}: mark which answers pass`);
      }
    }
  }
}

function _stats(totals: runsModel.RunTotals[]) {
  let sum = (pick: (t: runsModel.RunTotals) => boolean, field: 'runs' | 'latency_ms' | 'input_tokens' = 'runs') => totals.filter(pick).reduce((acc, t) => acc + Number(t[field]), 0);
  let runs = sum(() => true);

  return {
    runs,
    pass: sum((t) => t.verdict === 'pass'),
    fail: sum((t) => t.verdict === 'fail'),
    review: sum((t) => t.verdict === 'review'),
    retake: sum((t) => t.verdict === 'retake'),
    needs_review: sum((t) => t.verdict === 'review' && !t.final_verdict),
    avg_latency_ms: runs ? Math.round(sum(() => true, 'latency_ms') / runs) : null,
    input_tokens: sum(() => true, 'input_tokens'),
  };
}

// Jev's call per item against the person's call, wherever someone reviewed that item.
function _agreement(itemIds: number[], runs: runsModel.Run[]) {
  return itemIds.map((itemId) => {
    let reviewed = 0;
    let agreed = 0;
    let unsure = 0;

    for (let run of runs) {
      let review = run.reviews.find((r) => r.item_id === itemId);
      let result = run.results.find((r) => r.item_id === itemId);

      if (!review || !result) {
        continue;
      }

      reviewed++;
      result.outcome === 'review' ? unsure++ : result.outcome === review.outcome ? agreed++ : null;
    }

    return {item_id: itemId, reviewed, agreed, unsure};
  });
}
