'use client';

import {createContext, useContext} from 'react';

import type {ChecklistDetail} from '@/lib/api';

export const ChecklistContext = createContext<{checklist: ChecklistDetail; refresh: () => Promise<void>} | null>(null);

export function useChecklist() {
  const ctx = useContext(ChecklistContext);

  if (!ctx) {
    throw new Error('useChecklist must be used inside a checklist page');
  }

  return ctx;
}
