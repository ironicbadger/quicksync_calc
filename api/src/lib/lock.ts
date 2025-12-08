/**
 * KV-based locking for R2 writes.
 * Prevents race conditions during concurrent submissions.
 */

const LOCK_KEY = 'benchmarks-write-lock';
const LOCK_TTL = 30; // seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

/**
 * Acquire a lock for writing to R2.
 * Returns the lock value if acquired, null if lock is held.
 */
export async function acquireLock(kv: KVNamespace): Promise<string | null> {
  const existing = await kv.get(LOCK_KEY);
  if (existing) {
    return null; // Lock is held by another request
  }

  const lockValue = crypto.randomUUID();
  await kv.put(LOCK_KEY, lockValue, { expirationTtl: LOCK_TTL });

  // Verify we got the lock (handle race condition)
  const check = await kv.get(LOCK_KEY);
  if (check !== lockValue) {
    return null; // Another request won the race
  }

  return lockValue;
}

/**
 * Release a lock.
 */
export async function releaseLock(kv: KVNamespace, lockValue: string): Promise<void> {
  // Only release if we still own the lock
  const current = await kv.get(LOCK_KEY);
  if (current === lockValue) {
    await kv.delete(LOCK_KEY);
  }
}

/**
 * Execute a function with a lock.
 * Retries if lock is not immediately available.
 */
export async function withLock<T>(
  kv: KVNamespace,
  fn: () => Promise<T>
): Promise<T> {
  let lockValue: string | null = null;
  let attempts = 0;

  // Try to acquire lock with retries
  while (attempts < MAX_RETRIES) {
    lockValue = await acquireLock(kv);
    if (lockValue) {
      break;
    }
    attempts++;
    if (attempts < MAX_RETRIES) {
      await sleep(RETRY_DELAY);
    }
  }

  if (!lockValue) {
    throw new Error('Failed to acquire lock after multiple attempts. Please try again.');
  }

  try {
    return await fn();
  } finally {
    await releaseLock(kv, lockValue);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
