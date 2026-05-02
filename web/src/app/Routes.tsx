import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '../layout/Layout'
import { AboutPage } from '../pages/about/AboutPage'
import { CpuGenPage } from '../pages/cpuGen/CpuGenPage'
import { HomePage } from '../pages/home/HomePage'
import { LeaderboardPage } from '../pages/leaderboard/LeaderboardPage'
import { NotFoundPage } from '../pages/notFound/NotFoundPage'
import { SubmitPage } from '../pages/submit/SubmitPage'

export function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/submit" element={<SubmitPage />} />
        <Route path="/cpu/gen/:gen" element={<CpuGenPage />} />

        {/* Legacy redirect paths kept for backwards compatibility */}
        <Route path="/gpu/arc/*" element={<Navigate to="/cpu/gen/arc" replace />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  )
}

