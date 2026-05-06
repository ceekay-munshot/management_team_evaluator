import { CompanyEvaluation, ScoringWeights, EnrichedCohesionPair } from '@/types/evaluation';
import { ScoreOverview } from './dashboard/ScoreOverview';
import { OrgChart } from './dashboard/OrgChart';
import { ExecutiveProfiles } from './dashboard/ExecutiveProfiles';
import { CohesionPanel } from './dashboard/CohesionPanel';
import { BoardComposition } from './dashboard/BoardComposition';
import { WeightsPanel } from './dashboard/WeightsPanel';
import { RisksFlags } from './dashboard/RisksFlags';
import { useAppShell, NavSection } from './AppShell';

interface Props {
  evaluation: CompanyEvaluation;
  onWeightsChange: (weights: ScoringWeights) => void;
  onReEvaluate?: () => void;
  onEnrichmentComplete: (pairs: EnrichedCohesionPair[]) => void;
}

export const EvaluationDashboard = ({ evaluation, onWeightsChange, onReEvaluate, onEnrichmentComplete }: Props) => {
  const { activeSection } = useAppShell();

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return <ScoreOverview evaluation={evaluation} />;
      case 'org-chart':
        return <OrgChart executives={evaluation.executives} />;
      case 'executives':
        return <ExecutiveProfiles executives={evaluation.executives} />;
      case 'cohesion':
        return (
          <CohesionPanel
            executives={evaluation.executives}
            cohesionPairs={evaluation.cohesionPairs}
            enrichedCohesion={evaluation.enrichedCohesion}
            companyName={evaluation.companyName}
            onEnrichmentComplete={onEnrichmentComplete}
          />
        );
      case 'board':
        return <BoardComposition boardMembers={evaluation.boardMembers} />;
      case 'scoring':
        return (
          <WeightsPanel
            weights={evaluation.weights}
            onChange={onWeightsChange}
            onReEvaluate={onReEvaluate}
          />
        );
      case 'risks':
        return <RisksFlags evaluation={evaluation} />;
      case 'notes':
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Notes & Exports</h2>
            {evaluation.aiResearchSummary && (
              <div className="rounded-lg border bg-card p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">AI Research Summary</h3>
                <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
                  {evaluation.aiResearchSummary}
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">PDF export coming soon.</p>
          </div>
        );
      default:
        return <ScoreOverview evaluation={evaluation} />;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {renderSection()}
    </div>
  );
};
