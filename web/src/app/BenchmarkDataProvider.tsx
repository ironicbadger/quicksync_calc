import { type ReactNode, useEffect } from 'react'
import { useBenchmarkDataStore } from './benchmarkDataStore'

export function BenchmarkDataProvider({ children }: { children: ReactNode }) {
  const load = useBenchmarkDataStore((s) => s.load)

  useEffect(() => {
    void load()
  }, [load])

  return <>{children}</>
}
