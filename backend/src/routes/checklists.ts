import {Router} from 'express';

import * as controller from '@/controllers/checklists';

export const router = Router();

router.post('/', controller.createChecklist);
router.get('/', controller.getChecklists);
router.get('/:checklist_id', controller.getChecklist);
router.put('/:checklist_id', controller.updateChecklist);
