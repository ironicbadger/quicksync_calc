import { BrowserRouter } from 'react-router-dom'
import { BenchmarkDataProvider } from './BenchmarkDataProvider'
import { AppRoutes } from './Routes'

export default function App() {
  return (
    <BrowserRouter>
      <BenchmarkDataProvider>
        <AppRoutes />
      </BenchmarkDataProvider>
    </BrowserRouter>
  )
}

