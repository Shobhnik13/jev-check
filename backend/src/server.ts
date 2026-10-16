import express, {type NextFunction, type Request, type Response} from 'express';
import {MulterError} from 'multer';

import {router as checklistsRouter} from '@/routes/checklists';
import {router as filesRouter} from '@/routes/files';
import {router as objectsRouter} from '@/routes/objects';
import {router as ownersRouter} from '@/routes/owners';
import {router as referencesRouter} from '@/routes/references';
import {router as runsRouter} from '@/routes/runs';

import {owners} from '@/middlewares/owners';

import {config, initDb} from '@/configs/config';
import {AppError, getStatus, isStatusCode, success} from '@/configs/status';

const app = express();

app.disable('x-powered-by');

app.get('/healthchecks', (_req, res) => {
  res.json(success('health', {ok: true}));
});

app.use((req, res, next) => {
  let startedAt = Date.now();
  res.on('finish', () => console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`));
  next();
});

app.use(express.json({limit: '1mb'}));
app.use(owners);

// Routes
app.use('/checklists', checklistsRouter);
app.use('/files', filesRouter);
app.use('/objects', objectsRouter);
app.use('/owners', ownersRouter);
app.use('/references', referencesRouter);
app.use('/runs', runsRouter);

app.use(() => {
  throw new AppError('url_missing');
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  let status;

  if (err instanceof AppError) {
    status = getStatus(err.code, err.detail);
  } else if (err instanceof MulterError) {
    status = getStatus(err.code === 'LIMIT_FILE_SIZE' ? 'image_invalid' : 'input_invalid', err.message);
  } else if ((err as {type?: string})?.type === 'entity.parse.failed') {
    status = getStatus('input_invalid', 'malformed JSON body');
  } else if (err instanceof Error && isStatusCode(err.message)) {
    status = getStatus(err.message);
  } else if ((err as {status?: number})?.status === 404) {
    status = getStatus('entity_missing', 'file');
  } else {
    console.error(err);
    status = getStatus('generic_fail');
  }

  res.status(status.http).json(status.body);
});

await initDb();

app.listen(config.PORT, () => {
  console.log(`jev-checks backend on :${config.PORT} (model ${config.JEV.MODEL}${config.JEV.MOCK ? ', MOCK' : ''})`);
});
