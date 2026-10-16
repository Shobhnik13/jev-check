import {Router} from 'express';

import * as controller from '@/controllers/owners';

export const router = Router();

router.get('/*path', controller.getFile);
