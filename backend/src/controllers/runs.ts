import type {Request, Response} from 'express';

import {AppError, success} from '@/configs/status';

import * as runsService from '@/services/runs';

import type {RunSource, Verdict} from '@/services/types';

const SOURCES: RunSource[] = ['snap', 'live', 'upload', 'api'];
const VERDICTS: Verdict[] = ['pass', 'fail', 'review', 'retake'];
const OUTCOMES = ['pass', 'fail'] as const;

// Multipart with an image runs a check; JSON with a preview_id saves a live-mode preview.
export async function createRun(req: Request, res: Response) {
  if (!req.body?.checklist_id || (!req.file && !req.body?.preview_id)) {
    throw new AppError('input_missing', 'checklist_id and image (or preview_id)');
  }

  let runParams: Parameters<typeof runsService.createRun>[0] = {ownerId: req.owner.id, checklistId: parseInt(req.body.checklist_id)};
  req.file ? (runParams.image = req.file.buffer) : (runParams.previewId = String(req.body.preview_id));
  req.body.source ? (runParams.source = _oneOf(req.body.source, SOURCES, 'source')) : null;
  Object.hasOwn(req.body, 'save') ? (runParams.save = req.body.save !== '0' && req.body.save !== false) : null;

  let result = await runsService.createRun(runParams);
  res.json(success('run', result));
}

export async function getRuns(req: Request, res: Response) {
  let runParams: Parameters<typeof runsService.getRuns>[0] = {ownerId: req.owner.id};
  req.query.checklist_id ? (runParams.checklistId = parseInt(req.query.checklist_id as string)) : null;
  req.query.verdict ? (runParams.verdict = _oneOf(req.query.verdict, VERDICTS, 'verdict')) : null;
  req.query.unreviewed === '1' ? (runParams.unreviewed = true) : null;
  req.query.limit ? (runParams.limit = Math.min(500, parseInt(req.query.limit as string))) : null;

  let result = await runsService.getRuns(runParams);
  res.json(success('runs', result));
}

export async function getRun(req: Request, res: Response) {
  let runParams = {ownerId: req.owner.id, runId: parseInt(req.params.run_id as string)};

  let result = await runsService.getRun(runParams);
  res.json(success('run', result));
}

export async function updateRun(req: Request, res: Response) {
  let body = req.body ?? {};
  let runParams: Parameters<typeof runsService.updateRun>[0] = {ownerId: req.owner.id, runId: parseInt(req.params.run_id as string)};
  body.final_verdict ? (runParams.finalVerdict = _oneOf(body.final_verdict, [...OUTCOMES], 'final_verdict')) : null;
  Array.isArray(body.reviews)
    ? (runParams.reviews = body.reviews.map((r: {item_id?: unknown; outcome?: unknown}) => ({itemId: parseInt(String(r?.item_id)), outcome: _oneOf(r?.outcome, [...OUTCOMES], 'outcome')})))
    : null;
  Object.hasOwn(body, 'active') ? (runParams.active = Boolean(Number(body.active))) : null;

  let result = await runsService.updateRun(runParams);
  res.json(success('run', result));
}

function _oneOf<T extends string>(value: unknown, allowed: T[], name: string): T {
  if (!allowed.includes(value as T)) {
    throw new AppError('input_invalid', `${name} must be one of ${allowed.join(', ')}`);
  }

  return value as T;
}
