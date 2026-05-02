import { create } from 'zustand'
import { DATA_URL } from './config'
import { parseBenchmarkData, type BenchmarkData } from './types'

export type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: BenchmarkData }
  | { status: 'error'; error: Error }

type BenchmarkDataStore = {
  dataUrl: string
  state: LoadState
  load: (opts?: { url?: string; force?: boolean }) => Promise<void>
}

let cachedData: BenchmarkData | null = null
let cachedPromise: Promise<BenchmarkData> | null = null
let cachedUrl: string | null = null
let lastLoadToken = 0

async function fetchBenchmarkData(url: string, { force }: { force?: boolean } = {}): Promise<BenchmarkData> {
  if (force || (cachedUrl && cachedUrl !== url)) {
    cachedData = null
    cachedPromise = null
    cachedUrl = null
  }

  if (cachedData) return cachedData
  if (cachedPromise) return cachedPromise

  const requestUrl = url
  cachedUrl = url
  cachedPromise = fetch(url)
    .then(async (res) => {
      if (!res.ok) throw new Error(`Failed to load data: ${res.status}`)
      return res.json() as Promise<unknown>
    })
    .then((json) => {
      const data = parseBenchmarkData(json)
      if (cachedUrl === requestUrl) cachedData = data
      return data
    })
    .catch((err: unknown) => {
      if (cachedUrl === requestUrl) {
        cachedPromise = null
        cachedUrl = null
      }
      throw err
    })

  return cachedPromise
}

export const useBenchmarkDataStore = create<BenchmarkDataStore>((set, get) => ({
  dataUrl: DATA_URL,
  state: { status: 'loading' },
  async load(opts) {
    const url = opts?.url ?? get().dataUrl
    const force = opts?.force ?? false

    const current = get()
    if (!force && url === current.dataUrl) {
      if (current.state.status === 'ready' && cachedData && cachedUrl === url) return
      if (current.state.status === 'loading' && cachedPromise && cachedUrl === url) return
    }

    const loadToken = ++lastLoadToken
    set({ dataUrl: url, state: { status: 'loading' } })

    try {
      const data = await fetchBenchmarkData(url, { force })
      if (loadToken !== lastLoadToken) return
      set({ dataUrl: url, state: { status: 'ready', data } })
    } catch (err: unknown) {
      if (loadToken !== lastLoadToken) return
      const error = err instanceof Error ? err : new Error('Unknown error')
      set({ dataUrl: url, state: { status: 'error', error } })
    }
  },
}))

export function clearBenchmarkDataCache() {
  cachedData = null
  cachedPromise = null
  cachedUrl = null
}
