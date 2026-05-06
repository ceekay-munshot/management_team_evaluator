import { CompanyEvaluation, ScoringWeights, ScoringDimension } from '@/types/evaluation';

const DIMENSIONS: ScoringDimension[] = [
  'tenure_stability',
  'execution_track_record',
  'capital_allocation',
  'insider_alignment',
  'team_cohesion',
];

export function calculateCompositeScore(
  dimensionScores: Record<ScoringDimension, number>,
  weights: ScoringWeights
): number {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return 0;

  let weightedSum = 0;
  for (const dim of DIMENSIONS) {
    weightedSum += (dimensionScores[dim] || 0) * (weights[dim] || 0);
  }
  return Math.round(weightedSum / totalWeight);
}

export function recalculateEvaluation(
  evaluation: CompanyEvaluation,
  weights: ScoringWeights
): CompanyEvaluation {
  const dimensionScores: Record<string, number> = {};
  for (const score of evaluation.overallScores) {
    dimensionScores[score.dimension] = score.score;
  }

  const compositeScore = calculateCompositeScore(
    dimensionScores as Record<ScoringDimension, number>,
    weights
  );

  // Recalculate each executive's composite too
  const executives = evaluation.executives.map(exec => {
    const execDimScores: Record<string, number> = {};
    for (const s of exec.scores) {
      execDimScores[s.dimension] = s.score;
    }
    return {
      ...exec,
      compositeScore: calculateCompositeScore(
        execDimScores as Record<ScoringDimension, number>,
        weights
      ),
    };
  });

  return { ...evaluation, executives, compositeScore, weights };
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-accent';
  if (score >= 65) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  if (score >= 35) return 'text-orange-500';
  return 'text-destructive';
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Average';
  if (score >= 35) return 'Below Average';
  return 'Poor';
}
