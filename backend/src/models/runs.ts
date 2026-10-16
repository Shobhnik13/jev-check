import {db} from '@/configs/config';
import {AppError} from '@/configs/status';

import type {ItemResult, RunSource, Verdict} from '@/services/types';

export type Review = {item_id: number; outcome: 'pass' | 'fail'; created_at: string};

export type Run = {
  id: number;
  owner_id: number;
  checklist_id: number;
  source: RunSource;
  image: string;
  width: number;
  height: number;
  quality: number;
  verdict: Verdict;
  final_verdict: 'pass' | 'fail' | null;
  results: ItemResult[];
  latency_ms: number;
  input_tokens: number;
  model: string;
  reviewed_at: string | null;
  active: boolean;
  created_at: string;
  reviews: Review[];
};

export type RunInsert = Omit<Run, 'id' | 'final_verdict' | 'reviewed_at' | 'active' | 'created_at' | 'reviews'>;

export type RunTotals = {verdict: Verdict; final_verdict: 'pass' | 'fail' | null; runs: number; latency_ms: number; input_tokens: number};

type RunRow = Omit<Run, 'results' | 'reviews'> & {results: string | ItemResult[]};
type ReviewRow = Review & {run_id: number};

export async function createRun(params: RunInsert): Promise<number> {
  if (!params.checklist_id || !params.image || !params.results) {
    throw new AppError('input_missing');
  }

  let result = await db('runs')
    .insert({...params, results: JSON.stringify(params.results)})
    .returning('id');
  return result[0].id;
}

export async function getRuns(params: {ownerId: number; checklistId?: number; verdict?: Verdict; unreviewed?: boolean; runIds?: number[]; limit?: number; active?: boolean}): Promise<Run[]> {
  if (!params.ownerId) {
    throw new AppError('input_missing');
  }

  let query = db('runs as r').select('r.*').where('r.owner_id', params.ownerId);
  params.checklistId ? query.where('r.checklist_id', params.checklistId) : null;
  params.verdict ? query.where('r.verdict', params.verdict) : null;
  params.unreviewed ? query.whereNull('r.reviewed_at') : null;
  params.runIds ? query.whereIn('r.id', params.runIds) : null;
  Object.hasOwn(params, 'active') ? query.where('r.active', params.active ? true : false) : null;
  params.limit ? query.limit(params.limit) : null;

  let rows: RunRow[] = await query.orderBy('r.id', 'desc');
  let reviews: ReviewRow[] = await db('reviews as v')
    .select('v.run_id', 'v.item_id', 'v.outcome', 'v.created_at')
    .whereIn(
      'v.run_id',
      rows.map((row) => row.id),
    )
    .where('v.active', true);

  return _collate(rows, reviews);
}

export async function getRun(params: {ownerId: number; runId: number}): Promise<Run | null> {
  if (!params.ownerId || !params.runId) {
    throw new AppError('input_missing');
  }

  let result = await getRuns({ownerId: params.ownerId, runIds: [params.runId]});
  return result[0] ?? null;
}

export async function getRunTotals(params: {ownerId: number; checklistIds: number[]}): Promise<(RunTotals & {checklist_id: number})[]> {
  if (!params.ownerId) {
    throw new AppError('input_missing');
  }

  return db('runs as r')
    .select('r.checklist_id', 'r.verdict', 'r.final_verdict')
    .count({runs: '*'})
    .sum({latency_ms: 'r.latency_ms', input_tokens: 'r.input_tokens'})
    .where('r.owner_id', params.ownerId)
    .whereIn('r.checklist_id', params.checklistIds)
    .where('r.active', true)
    .groupBy('r.checklist_id', 'r.verdict', 'r.final_verdict');
}

export async function updateRun(params: {runId: number; finalVerdict?: 'pass' | 'fail'; reviews?: {itemId: number; outcome: 'pass' | 'fail'}[]; active?: boolean}) {
  if (!params.runId) {
    throw new AppError('input_missing');
  }

  let now = new Date().toISOString();
  let _update: Record<string, unknown> = {updated_at: now};
  params.finalVerdict ? Object.assign(_update, {final_verdict: params.finalVerdict, reviewed_at: now}) : null;
  Object.hasOwn(params, 'active') ? (_update.active = params.active ? true : false) : null;
  _update.active === false ? (_update.deleted_at = now) : null;

  await db.transaction(async (trx) => {
    await trx('runs').where('id', params.runId).update(_update);

    for (let review of params.reviews ?? []) {
      await trx('reviews')
        .insert({run_id: params.runId, item_id: review.itemId, outcome: review.outcome})
        .onConflict(['run_id', 'item_id'])
        .merge({outcome: review.outcome, updated_at: now});
    }
  });
}

function _collate(rows: RunRow[], reviews: ReviewRow[]): Run[] {
  return rows.map((row) => ({
    ...row,
    results: typeof row.results === 'string' ? JSON.parse(row.results) : row.results,
    quality: Number(row.quality),
    reviews: reviews.filter((review) => review.run_id === row.id).map(({item_id, outcome, created_at}) => ({item_id, outcome, created_at})),
  }));
}
