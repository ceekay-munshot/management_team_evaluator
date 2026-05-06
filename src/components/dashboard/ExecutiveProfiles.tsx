import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Executive, DIMENSION_LABELS } from '@/types/evaluation';
import { getScoreColor } from '@/lib/scoring';
import { User, TrendingUp, Briefcase } from 'lucide-react';
import { useState } from 'react';

const MetricCard = ({ label, value }: { label: string; value?: string }) => (
  <div className="rounded-lg bg-muted/50 p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-semibold font-mono">{value || 'Pending analysis'}</p>
  </div>
);

interface Props {
  executives: Executive[];
}

export const ExecutiveProfiles = ({ executives }: Props) => {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedExec = executives.find(e => e.id === selected);

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      {/* List */}
      <div className="space-y-1.5">
        {executives.map(exec => (
          <div
            key={exec.id}
            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
              selected === exec.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'
            }`}
            onClick={() => setSelected(exec.id)}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{exec.name}</p>
              <p className="text-xs text-muted-foreground truncate">{exec.title}</p>
            </div>
            <span className={`text-sm font-mono font-bold ${getScoreColor(exec.compositeScore)}`}>
              {exec.compositeScore}
            </span>
          </div>
        ))}
      </div>

      {/* Detail */}
      {selectedExec ? (
        <Card>
          <CardContent className="p-5 space-y-5">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <User className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{selectedExec.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedExec.title}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {selectedExec.age && <span>Age {selectedExec.age}</span>}
                  <span>Tenure: {selectedExec.tenureYears}y</span>
                  {selectedExec.ownershipStake && <span>Owns {selectedExec.ownershipStake}</span>}
                </div>
              </div>
            </div>

            {/* Financial metrics */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Financial Performance
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="Revenue Growth" value={selectedExec.financialMetrics.revenueGrowth} />
                <MetricCard label="Margin Trend" value={selectedExec.financialMetrics.marginTrend} />
                <MetricCard label="ROIC" value={selectedExec.financialMetrics.roic} />
              </div>
              {selectedExec.financialMetrics.notableMetrics && selectedExec.financialMetrics.notableMetrics.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedExec.financialMetrics.notableMetrics.map((m, i) => (
                    <Badge key={i} variant="outline" className="text-xs font-normal">{m}</Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Prior roles */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" /> Prior Roles
              </h4>
              <div className="space-y-1.5">
                {selectedExec.priorRoles.map((role, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{role.title}</span>
                    <span className="text-muted-foreground">at {role.company}</span>
                    <Badge variant="secondary" className="text-xs">{role.years}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Scores */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sub-Scores</h4>
              <div className="space-y-2">
                {selectedExec.scores.map(s => (
                  <div key={s.dimension} className="flex items-center gap-3">
                    <span className="text-xs w-28 truncate">{DIMENSION_LABELS[s.dimension]}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${s.score}%` }} />
                    </div>
                    <span className={`text-xs font-mono font-semibold w-6 text-right ${getScoreColor(s.score)}`}>{s.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <p>Select an executive to view their detailed profile</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
