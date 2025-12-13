type Props = { score: number }

export function ScoreBadge({ score }: Props) {
  const scoreClass = score >= 70 ? 'score-high' : score >= 40 ? 'score-mid' : 'score-low'
  return <span className={`score-badge ${scoreClass}`}>{score}</span>
}

