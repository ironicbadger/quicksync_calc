/**
 * Cloudflare Cache API utilities for aggressive caching.
 *
 * Cache tiers:
 * - STATIC (24h): CPU architectures, filter options - rarely change
 * - SEMI_STATIC (15min): Generation stats, scores - change when new results added
 * - DYNAMIC (5min): Query results, boxplot data - moderate refresh
 * - REALTIME (60s): Filter counts - user-filter-dependent
 */

export const CACHE_TTL = {
  STATIC: 86400,      // 24 hours
  SEMI_STATIC: 900,   // 15 minutes
  DYNAMIC: 300,       // 5 minutes
  REALTIME: 60,       // 1 minute
} as const;

/**
 * Wrap an endpoint handler with Cloudflare Cache API caching.
 *
 * Uses the full request URL (including query params) as cache key.
 * Returns cached response if available, otherwise fetches fresh data
 * and stores in cache.
 *
 * @param request - The incoming request (used for cache key)
 * @param ttlSeconds - Cache TTL in seconds
 * @param fetchData - Async function that returns the data to cache
 * @returns Response with appropriate cache headers
 */
export async function withCache<T>(
  request: Request,
  ttlSeconds: number,
  fetchData: () => Promise<T>
): Promise<Response> {
  const cache = caches.default;

  // Use GET method for cache key (POST requests can't be cached)
  const cacheKey = new Request(request.url, { method: 'GET' });

  // Check cache first
  const cached = await cache.match(cacheKey);
  if (cached) {
    // Clone and add header to indicate cache hit (for debugging)
    const headers = new Headers(cached.headers);
    headers.set('X-Cache', 'HIT');
    return new Response(cached.body, {
      status: cached.status,
      headers,
    });
  }

  // Fetch fresh data
  const data = await fetchData();

  const response = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`,
      'X-Cache': 'MISS',
    },
  });

  // Store in cache (fire and forget - don't block response)
  // Note: cache.put() requires a cloned response
  const cacheResponse = response.clone();
  // Remove X-Cache header before storing (it should reflect actual cache status)
  const cacheHeaders = new Headers(cacheResponse.headers);
  cacheHeaders.delete('X-Cache');
  const toCache = new Response(cacheResponse.body, {
    status: cacheResponse.status,
    headers: cacheHeaders,
  });

  cache.put(cacheKey, toCache);

  return response;
}

/**
 * Purge specific URLs from the cache.
 * Useful for invalidating cache after new data is submitted.
 *
 * Note: Cloudflare Cache API delete() only works for exact URL matches.
 * For pattern-based purging, you'd need Cloudflare's Purge API (paid feature).
 *
 * @param urls - Array of full URLs to purge
 */
export async function purgeCache(urls: string[]): Promise<void> {
  const cache = caches.default;

  await Promise.all(
    urls.map(url => {
      const cacheKey = new Request(url, { method: 'GET' });
      return cache.delete(cacheKey);
    })
  );
}
