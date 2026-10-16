import type {ItemDraft, ItemResult, ObjectRecord, Verdict} from '@/lib/api';

export const STRICTNESS = [
  {label: 'Relaxed', value: 0.6},
  {label: 'Normal', value: 0.7},
  {label: 'Strict', value: 0.85},
];

export function strictnessLabel(threshold: number) {
  return STRICTNESS.reduce((best, s) => (Math.abs(s.value - threshold) < Math.abs(best.value - threshold) ? s : best)).label;
}

export function ruleTitle(item: Pick<ItemDraft, 'type' | 'object_id' | 'question' | 'expect_present'> | undefined, objects: ObjectRecord[]) {
  if (!item) {
    return 'Rule';
  }

  if (item.type === 'present') {
    const name = objects.find((o) => o.id === item.object_id)?.name ?? 'Item';
    return item.expect_present ? `${name} is in the photo` : `${name} is not in the photo`;
  }

  return item.question || 'Untitled question';
}

export const VERDICT_TEXT: Record<Verdict, {title: string; short: string}> = {
  pass: {title: 'All good', short: 'Passed'},
  fail: {title: 'Something is wrong', short: 'Failed'},
  review: {title: 'Not sure, please take a look', short: 'Check me'},
  retake: {title: 'Photo is unclear, take another', short: 'Unclear'},
};

export function answerText(result: ItemResult) {
  if (result.outcome === 'review') {
    return 'Not sure';
  }

  return result.outcome === 'pass' ? 'Yes' : 'No';
}

// A ready-made check that works with any webcam and needs no photos of items.
export const DEMO_NAME = 'Demo: desk check';

export const DEMO_ITEMS: ItemDraft[] = [
  {type: 'yesno', question: 'Is there a cup, mug or bottle in the photo?', object_id: null, options: null, pass_options: null, expect_present: true, match: 'kind', threshold: 0.7},
  {type: 'yesno', question: 'Is there a laptop or keyboard in the photo?', object_id: null, options: null, pass_options: null, expect_present: true, match: 'kind', threshold: 0.7},
  {type: 'yesno', question: 'Is a person smiling in the photo?', object_id: null, options: null, pass_options: null, expect_present: true, match: 'kind', threshold: 0.7},
  {
    type: 'state',
    question: 'How bright is the room?',
    object_id: null,
    options: [
      {name: 'bright', description: 'well lit, easy to see'},
      {name: 'dim', description: 'a bit dark but visible'},
      {name: 'dark', description: 'hard to see anything'},
    ],
    pass_options: ['bright', 'dim'],
    expect_present: true,
    match: 'kind',
    threshold: 0.7,
  },
];

function question(text: string): ItemDraft {
  return {type: 'yesno', question: text, object_id: null, options: null, pass_options: null, expect_present: true, match: 'kind', threshold: 0.7};
}

export const TEMPLATES: {name: string; description: string; items: ItemDraft[]}[] = [
  {
    name: 'Delivery photo',
    description: 'Proof that a parcel was delivered',
    items: [question('Is there a parcel or package in the photo?'), question('Is the parcel at a door or doorstep?'), question('Is a shipping label visible on the parcel?')],
  },
  {
    name: 'Safety gear',
    description: 'Is the worker wearing the right gear?',
    items: [question('Is the person wearing a helmet or hard hat?'), question('Is the person wearing a high-visibility vest?'), question('Is the person wearing gloves?')],
  },
  {
    name: 'Packing check',
    description: 'Is the order box ready to ship?',
    items: [
      {
        type: 'state',
        question: 'Is the box closed?',
        object_id: null,
        options: [
          {name: 'sealed', description: 'closed and taped shut'},
          {name: 'open', description: 'flaps open, contents visible'},
          {name: 'damaged', description: 'torn, crushed or broken'},
        ],
        pass_options: ['sealed'],
        expect_present: true,
        match: 'kind',
        threshold: 0.7,
      },
      question('Is a shipping label stuck on the box?'),
    ],
  },
];
