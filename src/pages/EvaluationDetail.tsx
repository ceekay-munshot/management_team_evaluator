import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getFullEvaluation, saveEvaluation } from '@/lib/storage';
import { recalculateEvaluation } from '@/lib/scoring';
import { EvaluationDashboard } from '@/components/EvaluationDashboard';
import { AppShell } from '@/components/AppShell';
import { DEFAULT_WEIGHTS, EnrichedCohesionPair } from '@/types/evaluation';
import { useState, useCallback } from 'react';

const EvaluationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const stored = id ? getFullEvaluation(id) : null;
  const [evaluation, setEvaluation] = useState(stored);

  const handleWeightsChange = useCallback((newWeights: typeof DEFAULT_WEIGHTS) => {
    if (!evaluation) return;
    const updated = recalculateEvaluation(evaluation, newWeights);
    setEvaluation(updated);
    saveEvaluation(updated);
  }, [evaluation]);

  const handleEnrichmentComplete = useCallback((pairs: EnrichedCohesionPair[]) => {
    if (!evaluation) return;
    const updated = { ...evaluation, enrichedCohesion: pairs };
    setEvaluation(updated);
    saveEvaluation(updated);
  }, [evaluation]);

  if (!evaluation) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Evaluation not found.</p>
            <Button onClick={() => navigate('/')}>Go Home</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hasEvaluation companyName={evaluation.companyName} ticker={evaluation.ticker}>
      <EvaluationDashboard
        evaluation={evaluation}
        onWeightsChange={handleWeightsChange}
        onEnrichmentComplete={handleEnrichmentComplete}
      />
    </AppShell>
  );
};

export default EvaluationDetail;
