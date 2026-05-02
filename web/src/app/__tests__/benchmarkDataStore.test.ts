import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { clearBenchmarkDataCache, useBenchmarkDataStore } from '../benchmarkDataStore'

function makeMinimalBenchmarkData() {
  return {
    version: 1,
    lastUpdated: '2025-01-01T00:00:00.000Z',
    meta: { totalResults: 0, uniqueCpus: 0, architecturesCount: 0, uniqueTests: 0 },
    architectures: [],
    results: [],
    concurrencyResults: [],
    cpuFeatures: {},
  }
}

describe('useBenchmarkDataStore', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    clearBenchmarkDataCache()
    useBenchmarkDataStore.setState({ dataUrl: 'https://example.com/data.json', state: { status: 'loading' } })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    jest.restoreAllMocks()
  })

	  it('loads and stores parsed data', async () => {
	    const payload = makeMinimalBenchmarkData()

	    globalThis.fetch = jest.fn(() =>
	      Promise.resolve({
	        ok: true,
	        json: () => Promise.resolve(payload),
	      }),
	    ) as unknown as typeof fetch

	    await useBenchmarkDataStore.getState().load({ url: 'https://example.com/data.json', force: true })

    const state = useBenchmarkDataStore.getState()
    expect(state.state.status).toBe('ready')
    if (state.state.status !== 'ready') throw new Error('Expected ready state')
    expect(state.state.data.version).toBe(1)
  })

	  it('caches loads by default', async () => {
	    const payload = makeMinimalBenchmarkData()
	    const mockFetch = jest.fn(() =>
	      Promise.resolve({
	        ok: true,
	        json: () => Promise.resolve(payload),
	      }),
	    )

    globalThis.fetch = mockFetch as unknown as typeof fetch

    await useBenchmarkDataStore.getState().load({ url: 'https://example.com/data.json', force: true })
    await useBenchmarkDataStore.getState().load({ url: 'https://example.com/data.json' })

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

	  it('reports fetch failures', async () => {
	    globalThis.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 500 })) as unknown as typeof fetch

    await useBenchmarkDataStore.getState().load({ url: 'https://example.com/data.json', force: true })

    const state = useBenchmarkDataStore.getState()
    expect(state.state.status).toBe('error')
  })

	  it('reports schema validation failures', async () => {
	    globalThis.fetch = jest.fn(() =>
	      Promise.resolve({
	        ok: true,
	        json: () => Promise.resolve({ not: 'a benchmark data payload' }),
	      }),
	    ) as unknown as typeof fetch

    await useBenchmarkDataStore.getState().load({ url: 'https://example.com/data.json', force: true })

    const state = useBenchmarkDataStore.getState()
    expect(state.state.status).toBe('error')
  })
})
