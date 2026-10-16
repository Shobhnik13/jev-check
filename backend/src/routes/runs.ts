import {Router} from 'express';

import * as controller from '@/controllers/runs';

import {upload} from '@/routes/upload';

export const router = Router();

router.post('/', upload.single('image'), controller.createRun);
router.get('/', controller.getRuns);
router.get('/:run_id', controller.getRun);
router.put('/:run_id', controller.updateRun);
