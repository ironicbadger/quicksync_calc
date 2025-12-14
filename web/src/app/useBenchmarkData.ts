import { useShallow } from 'zustand/react/shallow'
import { useBenchmarkDataStore } from './benchmarkDataStore'

export function useBenchmarkData() {
  return useBenchmarkDataStore(useShallow((s) => ({ dataUrl: s.dataUrl, state: s.state })))
}

