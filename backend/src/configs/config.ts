import fs from 'node:fs';
import path from 'node:path';

import knex from 'knex';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

export const config = {
  PORT: Number(process.env.PORT || 4000),
  ROOT,
  DATA_DIR,
  UPLOADS_DIR,
  SQL_INIT: path.join(ROOT, 'docs/db/sql-init.sql'),
  JEV: {
    URL: process.env.JEV_URL || 'https://api.typesafe.ai/v1/systemone',
    MODEL: process.env.JEV_MODEL || 'jev-1.14.0',
    KEY: process.env.TYPESAFE_API_KEY || '',
    MOCK: process.env.JEV_MOCK === '1',
    TIMEOUT_MS: 20_000,
  },
  IMAGE: {
    MIN_SIDE: 280,
    MAX_SIDE: 1568,
    QUALITY: 85,
    REFERENCE_PAD: 0.08,
    MAX_UPLOAD_BYTES: 16 * 1024 * 1024,
  },
  OWNERS: {
    COOKIE: 'jev_owner',
    COOKIE_MAX_AGE_S: 365 * 24 * 3600,
    CACHE_TTL_MS: 60_000,
    SEEN_EVERY_MS: 10 * 60_000,
    LINK_TTL_MS: 10 * 60_000,
  },
  LIMITS: {
    // Every check spends Jev credits on the deployer's key, so anonymous owners are capped.
    CHECKS_PER_SECOND: Number(process.env.LIMIT_CHECKS_PER_SECOND || 4),
    CHECKS_PER_DAY: Number(process.env.LIMIT_CHECKS_PER_DAY || 1500),
    OWNERS_PER_IP_PER_DAY: Number(process.env.LIMIT_OWNERS_PER_IP_PER_DAY || 30),
  },
  RUNS: {
    MAX_REFERENCES_PER_OBJECT: 3,
    REVIEW_MARGIN: 0.15,
    RETAKE_BELOW: 0.4,
    PREVIEW_TTL_MS: 5 * 60_000,
    MAX_PREVIEWS: 100,
    WEBHOOK_TIMEOUT_MS: 5_000,
  },
};

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Put your Neon (or any Postgres) connection string in backend/.env');
}

export const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: {min: 0, max: Number(process.env.DB_POOL_MAX || 5)},
});

// The schema is idempotent. Serverless deploys skip it on cold start; run `npm run db:init` after schema changes.
export async function initDb() {
  await db.raw(fs.readFileSync(config.SQL_INIT, 'utf8'));
}
