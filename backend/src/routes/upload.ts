import multer from 'multer';

import {config} from '@/configs/config';

export const upload = multer({storage: multer.memoryStorage(), limits: {fileSize: config.IMAGE.MAX_UPLOAD_BYTES, files: 1}});
