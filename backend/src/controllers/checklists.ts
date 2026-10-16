import type {Request, Response} from 'express';

import {AppError, success} from '@/configs/status';

import * as checklistsService from '@/services/checklists';

import type {ItemInput} from '@/models/checklists';
import type {ItemType} from '@/services/types';

const ITEM_TYPES: ItemType[] = ['present', 'state', 'yesno'];

export async function createChecklist(req: Request, res: Response) {
  if (!req.body?.name || !Array.isArray(req.body?.items)) {
    throw new AppError('input_missing', 'name and items');
  }

  let checklistParams = {
    ownerId: req.owner.id,
    name: String(req.body.name).trim(),
    description: req.body.description ? String(req.body.description).trim() : null,
    webhookUrl: _webhook(req.body.webhook_url),
    items: _items(req.body.items),
  };

  let result = await checklistsService.createChecklist(checklistParams);
  res.json(success('checklist', result));
}

export async function getChecklists(req: Request, res: Response) {
  let result = await checklistsService.getChecklists({ownerId: req.owner.id});
  res.json(success('checklists', result));
}

export async function getChecklist(req: Request, res: Response) {
  let checklistParams = {ownerId: req.owner.id, checklistId: parseInt(req.params.checklist_id as string)};

  let result = await checklistsService.getChecklist(checklistParams);
  res.json(success('checklist', result));
}

export async function updateChecklist(req: Request, res: Response) {
  let body = req.body ?? {};
  let checklistParams: Parameters<typeof checklistsService.updateChecklist>[0] = {ownerId: req.owner.id, checklistId: parseInt(req.params.checklist_id as string)};
  body.name ? (checklistParams.name = String(body.name).trim()) : null;
  Object.hasOwn(body, 'description') ? (checklistParams.description = body.description ? String(body.description).trim() : null) : null;
  Object.hasOwn(body, 'webhook_url') ? (checklistParams.webhookUrl = _webhook(body.webhook_url)) : null;
  Array.isArray(body.items) ? (checklistParams.items = _items(body.items)) : null;
  Object.hasOwn(body, 'active') ? (checklistParams.active = Boolean(Number(body.active))) : null;

  let result = await checklistsService.updateChecklist(checklistParams);
  res.json(success('checklist', result));
}

function _items(input: unknown[]): ItemInput[] {
  return input.map((raw, n) => {
    let item = (raw ?? {}) as Record<string, unknown>;
    let threshold = Object.hasOwn(item, 'threshold') ? Number(item.threshold) : 0.7;

    if (!ITEM_TYPES.includes(item.type as ItemType)) {
      throw new AppError('input_invalid', `item ${n + 1}: type must be one of ${ITEM_TYPES.join(', ')}`);
    }

    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
      throw new AppError('input_invalid', `item ${n + 1}: threshold must be between 0 and 1`);
    }

    let options = Array.isArray(item.options)
      ? item.options.map((o: {name?: unknown; description?: unknown}) => ({name: String(o?.name ?? '').trim(), description: o?.description ? String(o.description).trim() : null})).filter((o) => o.name)
      : null;

    return {
      id: item.id ? parseInt(String(item.id)) : undefined,
      type: item.type as ItemType,
      object_id: item.object_id ? parseInt(String(item.object_id)) : null,
      question: item.question ? String(item.question).trim() : null,
      options: item.type === 'state' ? options : null,
      pass_options: item.type === 'state' && Array.isArray(item.pass_options) ? item.pass_options.map(String) : null,
      expect_present: Object.hasOwn(item, 'expect_present') ? Boolean(item.expect_present) : true,
      match: item.match === 'exact' ? 'exact' : 'kind',
      threshold,
      position: n,
    };
  });
}

function _webhook(value: unknown): string | null {
  if (!value) {
    return null;
  }

  try {
    let url = new URL(String(value));

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error();
    }

    return url.toString();
  } catch {
    throw new AppError('input_invalid', 'webhook_url must be an http(s) URL');
  }
}
