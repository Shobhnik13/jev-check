import {Router} from 'express';

import * as controller from '@/controllers/owners';

export const router = Router();

router.post('/links', controller.createLink);
router.post('/links/claim', controller.claimLink);
