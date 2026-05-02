type Props = { testName: string }

export function TestBadge({ testName }: Props) {
  const testClass = testName.includes('cpu') ? 'cpu' : testName.includes('hevc') ? 'hevc' : 'h264'
  return <span className={`test-badge ${testClass}`}>{testName}</span>
}

