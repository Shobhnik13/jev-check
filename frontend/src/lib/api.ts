export type Box = {top: number; bottom: number; left: number; right: number};

export type Reference = {id: number; object_id: number; image: string; crop: string; box: Box; width: number; height: number; created_at: string};

export type ObjectRecord = {id: number; name: string; label: string; created_at: string; references: Reference[]};

export type ItemType = 'present' | 'state' | 'yesno';

export type Option = {name: string; description: string | null};

export type Item = {
  id: number;
  object_id: number | null;
  type: ItemType;
  question: string | null;
  options: Option[] | null;
  pass_options: string[] | null;
  expect_present: boolean;
  match: 'kind' | 'exact';
  threshold: number;
};

export type ItemDraft = Omit<Item, 'id'> & {id?: number};

export type Stats = {runs: number; pass: number; fail: number; review: number; retake: number; needs_review: number; avg_latency_ms: number | null; input_tokens: number};

export type Agreement = {item_id: number; reviewed: number; agreed: number; unsure: number};

export type Checklist = {
  id: number;
  name: string;
  description: string | null;
  webhook_url: string | null;
  created_at: string;
  items: Item[];
  stats: Stats;
};

export type ChecklistDetail = Checklist & {objects: ObjectRecord[]; agreement: Agreement[]};

export type Outcome = 'pass' | 'fail' | 'review';

export type Verdict = 'pass' | 'fail' | 'review' | 'retake';

export type ItemResult = {
  item_id: number;
  type: ItemType;
  title: string;
  score: number;
  outcome: Outcome;
  choice: string | null;
  probabilities: Record<string, number> | null;
  box: Box | null;
  box_confidence: number | null;
};

export type RunResult = {quality: number; verdict: Verdict; results: ItemResult[]; latency_ms: number; input_tokens: number; model: string; width: number; height: number};

export type Preview = RunResult & {preview_id: string; checklist_id: number};

export type Run = RunResult & {
  id: number;
  checklist_id: number;
  source: 'snap' | 'live' | 'upload' | 'api';
  image: string;
  final_verdict: 'pass' | 'fail' | null;
  reviewed_at: string | null;
  created_at: string;
  reviews: {item_id: number; outcome: 'pass' | 'fail'}[];
};

export type Health = {ok: boolean; mock: boolean; model: string; key: boolean};

type Envelope<T> = {code: string; error: boolean; message: string; data: T};

export class ApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const BASE = '/api';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;

  try {
    res = await fetch(BASE + path, init);
  } catch {
    throw new ApiError('network_fail', 'Backend unreachable. Is it running on :4000?');
  }

  let body: Envelope<T>;

  try {
    body = await res.json();
  } catch {
    throw new ApiError('generic_fail', `Backend returned HTTP ${res.status}`);
  }

  if (body.error) {
    throw new ApiError(body.code, body.message);
  }

  return body.data;
}

function json(method: string, body: unknown): RequestInit {
  return {method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)};
}

function form(fields: Record<string, string | Blob | undefined>): RequestInit {
  const data = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    if (value instanceof Blob) {
      data.append(key, value, 'photo.jpg');
    } else if (value !== undefined) {
      data.append(key, value);
    }
  }

  return {method: 'POST', body: data};
}

export const api = {
  health: () => call<{health: Health}>('/healthchecks').then((d) => d.health),

  createObject: (body: {name?: string; label: string}) => call<{object: ObjectRecord}>('/objects', json('POST', body)).then((d) => d.object),
  getObjects: () => call<{objects: ObjectRecord[]}>('/objects').then((d) => d.objects),
  getObject: (id: number) => call<{object: ObjectRecord}>(`/objects/${id}`).then((d) => d.object),
  updateObject: (id: number, body: {name?: string; label?: string; active?: number}) => call<{object: ObjectRecord}>(`/objects/${id}`, json('PUT', body)).then((d) => d.object),

  createReference: (objectId: number, image: Blob) =>
    call<{reference: Reference & {located: {present: number; box_confidence: number; latency_ms: number} | null}}>('/references', form({object_id: String(objectId), image})).then((d) => d.reference),
  updateReference: (id: number, body: {box?: Box; active?: number}) => call<{reference: Reference}>(`/references/${id}`, json('PUT', body)).then((d) => d.reference),

  createChecklist: (body: {name: string; description?: string | null; webhook_url?: string | null; items: ItemDraft[]}) => call<{checklist: ChecklistDetail}>('/checklists', json('POST', body)).then((d) => d.checklist),
  getChecklists: () => call<{checklists: Checklist[]}>('/checklists').then((d) => d.checklists),
  getChecklist: (id: number) => call<{checklist: ChecklistDetail}>(`/checklists/${id}`).then((d) => d.checklist),
  updateChecklist: (id: number, body: {name?: string; description?: string | null; webhook_url?: string | null; items?: ItemDraft[]; active?: number}) =>
    call<{checklist: ChecklistDetail}>(`/checklists/${id}`, json('PUT', body)).then((d) => d.checklist),

  runCheck: (checklistId: number, image: Blob, source: Run['source']) => call<{run: Run}>('/runs', form({checklist_id: String(checklistId), image, source})).then((d) => d.run),
  previewCheck: (checklistId: number, image: Blob) => call<{run: Preview}>('/runs', form({checklist_id: String(checklistId), image, save: '0'})).then((d) => d.run),
  savePreview: (checklistId: number, previewId: string) => call<{run: Run}>('/runs', json('POST', {checklist_id: checklistId, preview_id: previewId, source: 'live'})).then((d) => d.run),
  getRuns: (params: {checklist_id?: number; verdict?: Verdict; unreviewed?: boolean}) => {
    const qs = new URLSearchParams();

    if (params.checklist_id) {
      qs.set('checklist_id', String(params.checklist_id));
    }

    if (params.verdict) {
      qs.set('verdict', params.verdict);
    }

    if (params.unreviewed) {
      qs.set('unreviewed', '1');
    }

    return call<{runs: Run[]}>(`/runs?${qs}`).then((d) => d.runs);
  },
  updateRun: (id: number, body: {final_verdict?: 'pass' | 'fail'; reviews?: {item_id: number; outcome: 'pass' | 'fail'}[]; active?: number}) => call<{run: Run}>(`/runs/${id}`, json('PUT', body)).then((d) => d.run),

  createLink: () => call<{link: {code: string; expires_at: string}}>('/owners/links', {method: 'POST'}).then((d) => d.link),
  claimLink: (code: string) => call<{link: {linked: boolean}}>('/owners/links/claim', json('POST', {code})).then((d) => d.link),

  fileUrl: (path: string) => `${BASE}/files/${path}`,
};

export const PRICE_PER_MTOK = 0.042;

export function cost(tokens: number) {
  const usd = (tokens / 1_000_000) * PRICE_PER_MTOK;
  return usd < 0.01 ? `$${usd.toFixed(5)}` : `$${usd.toFixed(3)}`;
}

export function pct(p: number) {
  return `${Math.round(p * 100)}%`;
}

export function errorText(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
