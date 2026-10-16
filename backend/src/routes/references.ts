import {Router} from 'express';

import * as controller from '@/controllers/objects';

import {upload} from '@/routes/upload';

export const router = Router();

router.post('/', upload.single('image'), controller.createReference);
router.put('/:reference_id', controller.updateReference);
