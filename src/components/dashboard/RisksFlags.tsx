import { Card, CardContent } from '@/components/ui/card';
import { CompanyEvaluation } from '@/types/evaluation';
import { getScoreColor } from '@/lib/scoring';

interface Props {
  evaluation: CompanyEvaluation;
}

export const RisksFlags = ({ evaluation }: Props) => {
  // Derive risks from scores
  const risks = evaluation.overallScores
    .filter(s => s.score < 50)
    .map(s => ({
      dimension: s.dimension,
      score: s.score,
      reasoning: s.reasoning,
    }));

  const lowCohesion = evaluation.overallScores.find(s => s.dimension === 'team_cohesion');
  const lowInsider = evaluation.overallScores.find(s => s.dimension === 'insider_alignment');

  const flags: { label: string; severity: 'high' | 'medium' | 'low'; detail: string }[] = [];

  if (lowCohesion && lowCohesion.score < 45) {
    flags.push({
      label: 'Low team cohesion',
      severity: 'high',
      detail: 'The leadership team has limited shared work history, increasing execution risk.',
    });
  }
  if (lowInsider && lowInsider.score < 40) {
    flags.push({
      label: 'Weak insider alignment',
      severity: 'high',
      detail: 'Low ownership stakes and/or net insider selling suggest misalignment with shareholders.',
    });
  }

  // Check for very new executives
  const newExecs = evaluation.executives.filter(e => e.tenureYears < 1.5);
  if (newExecs.length >= 3) {
    flags.push({
      label: `${newExecs.length} recently appointed executives`,
      severity: 'medium',
      detail: `Multiple new hires (${newExecs.map(e => e.name).join(', ')}) — transition risk is elevated.`,
    });
  }

  // High concentration risk
  const ceo = evaluation.executives.find(e => e.title.toLowerCase().includes('ceo'));
  if (ceo && ceo.tenureYears > 15) {
    flags.push({
      label: 'Key person dependency',
      severity: 'medium',
      detail: `CEO ${ceo.name} has ${ceo.tenureYears.toFixed(0)}+ years of tenure. Succession planning is critical.`,
    });
  }

  if (risks.length === 0 && flags.length === 0) {
    flags.push({
      label: 'No significant red flags detected',
      severity: 'low',
      detail: 'All scoring dimensions are within acceptable ranges.',
    });
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">Risks & Red Flags</h2>

      {/* Dimension-based risks */}
      {risks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Low-Scoring Dimensions</p>
          {risks.map(r => (
            <Card key={r.dimension} className="border-destructive/30">
              <CardContent className="p-4 flex items-start gap-3">
                <span className={`text-2xl font-bold font-mono ${getScoreColor(r.score)}`}>{r.score}</span>
                <div>
                  <p className="text-sm font-medium">{r.dimension.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.reasoning}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Flags */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Flags</p>
        {flags.map((f, i) => (
          <Card key={i} className={f.severity === 'high' ? 'border-destructive/30' : f.severity === 'medium' ? 'border-yellow-500/30' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-block h-2 w-2 rounded-full ${
                  f.severity === 'high' ? 'bg-destructive' : f.severity === 'medium' ? 'bg-yellow-500' : 'bg-accent'
                }`} />
                <p className="text-sm font-medium">{f.label}</p>
              </div>
              <p className="text-xs text-muted-foreground">{f.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
