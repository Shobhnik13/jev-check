import {randomUUID} from 'node:crypto';

import {config} from '@/configs/config';
import {AppError} from '@/configs/status';

import * as checklistsService from '@/services/checklists';
import * as imagesService from '@/services/images';
import * as jevService from '@/services/jev';
import * as limitsService from '@/services/limits';
import * as utilsService from '@/services/utils';

import * as runsModel from '@/models/runs';

import type {Item} from '@/models/checklists';
import type {ObjectRecord} from '@/models/objects';
import type {Img, ItemResult, Outcome, RunResult, RunSource, Verdict} from '@/services/types';

type Checklist = Awaited<ReturnType<typeof checklistsService.getChecklist>>;
type Preview = {id: string; ownerId: number; checklistId: number; img: Img; result: RunResult; expiresAt: number};

const {MAX_REFERENCES_PER_OBJECT, REVIEW_MARGIN, RETAKE_BELOW, PREVIEW_TTL_MS, MAX_PREVIEWS, WEBHOOK_TIMEOUT_MS} = config.RUNS;

// Live mode judges frames without saving them; the frame that finally passes is saved from here, not re-uploaded.
const previews = new Map<string, Preview>();
const crops = new Map<string, Buffer>();

export async function createRun(params: {ownerId: number; checklistId: number; image?: Buffer; previewId?: string; source?: RunSource; save?: boolean}) {
  if (!params.ownerId || !params.checklistId || (!params.image && !params.previewId)) {
    throw new AppError('input_missing');
  }

  if (params.previewId) {
    let preview = previews.get(params.previewId);
    let usable = preview && preview.expiresAt >= Date.now() && preview.ownerId === params.ownerId && preview.checklistId === params.checklistId;

    // Serverless instances don't share memory: without the cached preview, judge the resent frame again.
    if (!usable || !preview) {
      if (!params.image) {
        throw new AppError('preview_expired');
      }

      return createRun({...params, previewId: undefined, save: true});
    }

    previews.delete(preview.id);
    return _save(params.ownerId, await checklistsService.getChecklist({ownerId: params.ownerId, checklistId: params.checklistId, withStats: false}), preview.img, preview.result, params.source ?? 'live');
  }

  let checklist = await checklistsService.getChecklist({ownerId: params.ownerId, checklistId: params.checklistId, withStats: false});
  limitsService.spendCheck({ownerId: params.ownerId});
  let img = await imagesService.normalize(params.image as Buffer);
  let result = await _judge(checklist, img);

  if (params.save === false) {
    let id = randomUUID();
    _remember({id, ownerId: params.ownerId, checklistId: checklist.id, img, result, expiresAt: Date.now() + PREVIEW_TTL_MS});
    return {preview_id: id, checklist_id: checklist.id, ...result};
  }

  return _save(params.ownerId, checklist, img, result, params.source ?? 'snap');
}

export async function getRuns(params: {ownerId: number; checklistId?: number; verdict?: Verdict; unreviewed?: boolean; limit?: number}) {
  return runsModel.getRuns({...params, active: true, limit: params.limit ?? 200});
}

export async function getRun(params: {ownerId: number; runId: number}) {
  let run = await runsModel.getRun(params);

  if (!run || !run.active) {
    throw new AppError('entity_missing', 'run');
  }

  return run;
}

export async function updateRun(params: {ownerId: number; runId: number; finalVerdict?: 'pass' | 'fail'; reviews?: {itemId: number; outcome: 'pass' | 'fail'}[]; active?: boolean}) {
  let run = await getRun({ownerId: params.ownerId, runId: params.runId});
  let unknown = (params.reviews ?? []).find((review) => !run.results.some((result) => result.item_id === review.itemId));

  if (unknown) {
    throw new AppError('input_invalid', `item ${unknown.itemId} is not part of this run`);
  }

  let {ownerId, ...update} = params;
  await runsModel.updateRun(update);
  return runsModel.getRun({ownerId, runId: run.id});
}

// One Jev call per photo: a quality gate plus every checklist item, answered in parallel.
async function _judge(checklist: Checklist, img: Img): Promise<RunResult> {
  if (!checklist.items.length) {
    throw new AppError('checklist_empty');
  }

  let objects = new Map(checklist.objects.map((o) => [o.id, o]));
  let images = new jevService.Images();
  let photo = images.add(img.buffer);
  let refs = new Map<number, string[]>();

  let referencesFor = async (object: ObjectRecord, count: number) => {
    let added = refs.get(object.id) ?? [];

    for (let reference of object.references.slice(added.length, Math.min(count, MAX_REFERENCES_PER_OBJECT))) {
      added.push(images.add(await _crop(reference.crop)));
    }

    refs.set(object.id, added);
    return added;
  };

  let questions: Record<string, jevService.Question> = {
    quality: {type: 'noul', instructions: '`photo` is sharp and well lit enough to tell what is in it.'},
  };

  for (let item of checklist.items) {
    let object = item.object_id ? objects.get(item.object_id) : undefined;

    if (item.type === 'present' && !object?.references.length) {
      throw new AppError('reference_missing', object?.name);
    }

    let hint = object?.references.length ? ` The ${object.label} looks like this reference photo: ${(await referencesFor(object, 1))[0]}` : '';
    let key = `i${item.id}`;

    if (item.type === 'present' && object && item.match === 'exact') {
      let photos = await referencesFor(object, MAX_REFERENCES_PER_OBJECT);
      questions[`${key}_present`] = {
        type: 'noul',
        instructions: `Is the same ${object.label} as in these reference photos visible in \`photo\`? Reference photos: ${photos.join(', ')}`,
        criteria: {
          true: `The exact ${object.label} from the reference photos appears in \`photo\`, even from another angle, distance or lighting`,
          false: `The ${object.label} is absent, or only a different object of a similar kind appears`,
        },
      };
      questions[`${key}_box`] = {type: 'box', instructions: `the ${object.label} in \`photo\` that matches this reference photo: ${photos[0]}`};
    } else if (item.type === 'present' && object) {
      questions[`${key}_present`] = {type: 'noul', instructions: `Is there a ${object.label} in \`photo\`?${hint}`};
      questions[`${key}_box`] = {type: 'box', instructions: `the ${object.label} in \`photo\`.${hint}`};
    } else if (item.type === 'state') {
      questions[`${key}_state`] = {
        type: 'choice',
        instructions: `Looking at \`photo\`: ${item.question}${hint}`,
        criteria: Object.fromEntries((item.options ?? []).map((o) => [o.name, o.description])),
      };
    } else {
      questions[`${key}_yesno`] = {type: 'noul', instructions: `Looking at \`photo\`: ${item.question}${hint}`};
    }
  }

  let reply = await jevService.ask({photo, images, questions});
  let quality = jevService.noul(reply, 'quality');
  let results = checklist.items.map((item) => _result(item, objects.get(item.object_id ?? 0), reply));

  return {
    quality,
    verdict: _verdict(quality, results.map((r) => r.outcome)),
    results,
    latency_ms: reply.latency_ms,
    input_tokens: reply.input_tokens,
    model: reply.model,
    width: img.width,
    height: img.height,
  };
}

function _result(item: Item, object: ObjectRecord | undefined, reply: jevService.JevReply): ItemResult {
  let key = `i${item.id}`;
  let base = {item_id: item.id, type: item.type, choice: null, probabilities: null, box: null, box_confidence: null};

  if (item.type === 'present') {
    let present = jevService.noul(reply, `${key}_present`);
    let located = jevService.box(reply, `${key}_box`);
    let score = item.expect_present ? present : 1 - present;
    let title = `${object?.name ?? 'Object'} ${item.expect_present ? 'present' : 'absent'}`;
    return {...base, title, score, outcome: _outcome(score, item.threshold), box: present >= 0.5 ? located.box : null, box_confidence: located.confidence};
  }

  if (item.type === 'state') {
    let answer = jevService.choice(reply, `${key}_state`);
    let score = (item.pass_options ?? []).reduce((acc, name) => acc + (answer.probabilities[name] ?? 0), 0);
    return {...base, title: item.question ?? '', score, outcome: _outcome(score, item.threshold), choice: answer.choice, probabilities: answer.probabilities};
  }

  let score = jevService.noul(reply, `${key}_yesno`);
  return {...base, title: item.question ?? '', score, outcome: _outcome(score, item.threshold)};
}

function _outcome(score: number, threshold: number): Outcome {
  return score >= threshold ? 'pass' : score >= threshold - REVIEW_MARGIN ? 'review' : 'fail';
}

function _verdict(quality: number, outcomes: Outcome[]): Verdict {
  return quality < RETAKE_BELOW ? 'retake' : outcomes.includes('fail') ? 'fail' : outcomes.includes('review') ? 'review' : 'pass';
}

async function _save(ownerId: number, checklist: Checklist, img: Img, result: RunResult, source: RunSource) {
  let image = `${utilsService.ownerDir(ownerId)}/checklists/${checklist.id}/runs/${randomUUID()}.jpg`;
  await utilsService.writeUpload(image, img.buffer);

  let runId = await runsModel.createRun({
    owner_id: ownerId,
    checklist_id: checklist.id,
    source,
    image,
    width: result.width,
    height: result.height,
    quality: result.quality,
    verdict: result.verdict,
    results: result.results,
    latency_ms: result.latency_ms,
    input_tokens: result.input_tokens,
    model: result.model,
  });

  let run = await getRun({ownerId, runId});
  checklist.webhook_url ? _notify(checklist.webhook_url, run) : null;
  return run;
}

function _notify(url: string, run: runsModel.Run) {
  fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({event: 'run.completed', run}), signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS)}).catch((err) =>
    console.warn(`webhook ${url} failed: ${err instanceof Error ? err.message : err}`),
  );
}

async function _crop(relativePath: string): Promise<Buffer> {
  let buffer = crops.get(relativePath);

  if (!buffer) {
    buffer = await utilsService.readUpload(relativePath);
    crops.set(relativePath, buffer);
  }

  return buffer;
}

function _remember(preview: Preview) {
  let now = Date.now();

  for (let [id, cached] of previews) {
    if (cached.expiresAt < now || previews.size >= MAX_PREVIEWS) {
      previews.delete(id);
    }
  }

  previews.set(preview.id, preview);
}
