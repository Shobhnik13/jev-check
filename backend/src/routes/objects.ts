import {Router} from 'express';

import * as controller from '@/controllers/objects';

export const router = Router();

router.post('/', controller.createObject);
router.get('/', controller.getObjects);
router.get('/:object_id', controller.getObject);
router.put('/:object_id', controller.updateObject);
