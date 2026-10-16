import {api} from '@/lib/api';
import {DEMO_ITEMS, DEMO_NAME} from '@/lib/rules';

// Reuses the demo check if it exists, so repeated clicks don't pile up copies.
export async function demoChecklistId() {
  const existing = (await api.getChecklists()).find((c) => c.name === DEMO_NAME);

  if (existing) {
    return existing.id;
  }

  const created = await api.createChecklist({name: DEMO_NAME, description: 'Try it with your laptop camera', items: DEMO_ITEMS});
  return created.id;
}
