import { Card, CardContent } from '@/components/ui/card';
import { CompanyEvaluation, DIMENSION_LABELS } from '@/types/evaluation';
import { getScoreColor, getScoreLabel } from '@/lib/scoring';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';

interface Props {
  evaluation: CompanyEvaluation;
}

export const ScoreOverview = ({ evaluation }: Props) => {
  const radarData = evaluation.overallScores.map(s => ({
    dimension: DIMENSION_LABELS[s.dimension],
    score: s.score,
    fullMark: 100,
  }));

  return (
    <div className="space-y-5">
      {/* Top row: overall score + dimension bars + radar */}
      <div className="grid gap-4 lg:grid-cols-[180px_1fr_240px]">
        {/* Overall score */}
        <Card className="flex flex-col items-center justify-center p-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Composite</p>
          <span className={`text-5xl font-bold font-mono ${getScoreColor(evaluation.compositeScore)}`}>
            {evaluation.compositeScore}
          </span>
          <span className={`text-xs font-medium mt-1 ${getScoreColor(evaluation.compositeScore)}`}>
            {getScoreLabel(evaluation.compositeScore)}
          </span>
        </Card>

        {/* Dimension bars */}
        <Card>
          <CardContent className="p-4 space-y-3">
            {evaluation.overallScores.map(s => (
              <div key={s.dimension} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{DIMENSION_LABELS[s.dimension]}</span>
                  <span className={`text-xs font-mono font-semibold ${getScoreColor(s.score)}`}>{s.score}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${s.score}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Radar */}
        <Card className="hidden lg:block">
          <CardContent className="p-2 h-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Executive summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {evaluation.executives.slice(0, 4).map(exec => (
          <Card key={exec.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{exec.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{exec.title}</p>
                </div>
                <span className={`text-lg font-bold font-mono ${getScoreColor(exec.compositeScore)}`}>
                  {exec.compositeScore}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{exec.tenureYears.toFixed(1)}yr tenure</span>
                {exec.ownershipStake && <span>· {exec.ownershipStake}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Summary */}
      {evaluation.aiResearchSummary && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">AI Assessment</h3>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{evaluation.aiResearchSummary}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
