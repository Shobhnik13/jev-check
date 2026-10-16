export type Box = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type Img = {
  buffer: Buffer;
  width: number;
  height: number;
};

export type ItemType = 'present' | 'state' | 'yesno';

// kind: any object of that type counts. exact: only the object in the reference photos, look-alikes fail.
export type MatchMode = 'kind' | 'exact';

export type Option = {name: string; description: string | null};

export type Outcome = 'pass' | 'fail' | 'review';

export type Verdict = 'pass' | 'fail' | 'review' | 'retake';

export type RunSource = 'snap' | 'live' | 'upload' | 'api';

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

export type RunResult = {
  quality: number;
  verdict: Verdict;
  results: ItemResult[];
  latency_ms: number;
  input_tokens: number;
  model: string;
  width: number;
  height: number;
};
