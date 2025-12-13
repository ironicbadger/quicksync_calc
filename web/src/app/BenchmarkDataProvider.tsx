import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { DATA_URL } from './config'
import type { BenchmarkData } from './types'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: BenchmarkData }
  | { status: 'error'; error: Error }

type BenchmarkDataContextValue = {
  dataUrl: string
  state: LoadState
}

const BenchmarkDataContext = createContext<BenchmarkDataContextValue | null>(null)

let cachedData: BenchmarkData | null = null
let cachedPromise: Promise<BenchmarkData> | null = null

async function fetchBenchmarkData(url: string): Promise<BenchmarkData> {
  if (cachedData) return cachedData
  if (cachedPromise) return cachedPromise

  cachedPromise = fetch(url)
    .then(async (res) => {
      if (!res.ok) throw new Error(`Failed to load data: ${res.status}`)
      return (await res.json()) as BenchmarkData
    })
    .then((data) => {
      cachedData = data
      return data
    })

  return cachedPromise
}

export function BenchmarkDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    fetchBenchmarkData(DATA_URL)
      .then((data) => {
        if (cancelled) return
        setState({ status: 'ready', data })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const error = err instanceof Error ? err : new Error('Unknown error')
        setState({ status: 'error', error })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<BenchmarkDataContextValue>(() => ({ dataUrl: DATA_URL, state }), [state])

  return <BenchmarkDataContext.Provider value={value}>{children}</BenchmarkDataContext.Provider>
}

export function useBenchmarkData() {
  const ctx = useContext(BenchmarkDataContext)
  if (!ctx) throw new Error('useBenchmarkData must be used within BenchmarkDataProvider')
  return ctx
}

