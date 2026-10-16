import {config} from '@/configs/config';
import {AppError} from '@/configs/status';

const {CHECKS_PER_SECOND, CHECKS_PER_DAY, OWNERS_PER_IP_PER_DAY} = config.LIMITS;

// In memory, so each server instance counts on its own: enough to stop abuse of the Jev key, not exact billing.
const buckets = new Map<number, {tokens: number; at: number}>();
const daily = new Map<string, number>();

export function spendCheck(params: {ownerId: number}) {
  let now = Date.now();
  let bucket = buckets.get(params.ownerId) ?? {tokens: CHECKS_PER_SECOND, at: now};
  bucket.tokens = Math.min(CHECKS_PER_SECOND, bucket.tokens + ((now - bucket.at) / 1000) * CHECKS_PER_SECOND);
  bucket.at = now;

  if (bucket.tokens < 1) {
    throw new AppError('rate_limited');
  }

  _count(`checks:${params.ownerId}`, CHECKS_PER_DAY, 'daily limit reached, try again tomorrow');
  bucket.tokens -= 1;
  buckets.set(params.ownerId, bucket);
}

export function spendNewOwner(params: {ip: string}) {
  _count(`owners:${params.ip}`, OWNERS_PER_IP_PER_DAY, 'too many new visitors from this network today');
}

function _count(key: string, limit: number, detail: string) {
  let dayKey = `${new Date().toISOString().slice(0, 10)}:${key}`;
  let used = daily.get(dayKey) ?? 0;

  if (used >= limit) {
    throw new AppError('rate_limited', detail);
  }

  if (daily.size > 50_000) {
    daily.clear();
  }

  daily.set(dayKey, used + 1);
}
