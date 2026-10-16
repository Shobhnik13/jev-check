'use client';

import {useChecklist} from '@/components/checklist-context';
import {ChecklistForm} from '@/components/checklist-form';

export default function EditChecklistPage() {
  const {checklist} = useChecklist();
  return <ChecklistForm checklist={checklist} />;
}
