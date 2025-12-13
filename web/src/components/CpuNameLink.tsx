import { Link } from 'react-router-dom'
import { getCpuLink, stripIntelBranding } from '../utils/quicksync'

type Props = {
  architecture?: string | null
  cpuRaw: string
  generation?: number | null
  showFullName?: boolean
  className?: string
}

export function CpuNameLink({ cpuRaw, architecture, generation, showFullName = false, className }: Props) {
  const displayName = showFullName ? cpuRaw : stripIntelBranding(cpuRaw)
  const href = getCpuLink(architecture, generation)

  if (href) {
    return (
      <Link to={href} className={className ?? 'cpu-link'} title={cpuRaw}>
        {displayName}
      </Link>
    )
  }

  return (
    <span className={className ?? 'cpu-name'} title={cpuRaw}>
      {displayName}
    </span>
  )
}

