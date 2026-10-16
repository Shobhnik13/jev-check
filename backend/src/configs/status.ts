const STATUSES = {
  success: {http: 200, message: 'Success'},
  input_missing: {http: 400, message: 'Required input is missing'},
  input_invalid: {http: 400, message: 'Input is invalid'},
  image_invalid: {http: 400, message: 'Image could not be read, or its size is outside what Jev accepts'},
  entity_missing: {http: 404, message: 'Not found'},
  url_missing: {http: 404, message: 'Unknown endpoint'},
  reference_missing: {http: 409, message: 'Add a reference photo for every object in this checklist'},
  checklist_empty: {http: 409, message: 'Add at least one item to this checklist'},
  preview_expired: {http: 410, message: 'This preview expired. Take the shot again'},
  link_invalid: {http: 400, message: 'That code is wrong or has expired. Get a new one on your other device'},
  rate_limited: {http: 429, message: 'Too many checks. Wait a moment and try again'},
  jev_key_missing: {http: 500, message: 'TYPESAFE_API_KEY is not set on the backend. Add it to backend/.env, or set JEV_MOCK=1'},
  jev_rejected: {http: 502, message: 'Jev rejected the request'},
  jev_fail: {http: 502, message: 'Jev request failed'},
  generic_fail: {http: 500, message: 'Something went wrong'},
} as const;

export type StatusCode = keyof typeof STATUSES;

export class AppError extends Error {
  code: StatusCode;
  detail?: string;

  constructor(code: StatusCode, detail?: string) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

export function isStatusCode(code: string): code is StatusCode {
  return Object.hasOwn(STATUSES, code);
}

export function getStatus(code: StatusCode, detail?: string) {
  let status = STATUSES[code];

  return {
    http: status.http,
    body: {
      code,
      error: code !== 'success',
      message: detail ? `${status.message}: ${detail}` : status.message,
      data: {} as Record<string, unknown>,
    },
  };
}

export function success<T>(key: string, value: T) {
  let {body} = getStatus('success');
  body.data = {[key]: value};
  return body;
}
