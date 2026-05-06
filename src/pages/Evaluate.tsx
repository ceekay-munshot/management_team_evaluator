import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, Circle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { CompanyEvaluation, EvaluationStatus, DEFAULT_WEIGHTS, EnrichedCohesionPair } from '@/types/evaluation';
import { saveEvaluation, getSavedWeights } from '@/lib/storage';
import { recalculateEvaluation } from '@/lib/scoring';
import { EvaluationDashboard } from '@/components/EvaluationDashboard';
import { evaluateCompany } from '@/lib/ai-evaluation';
import { AppShell } from '@/components/AppShell';
import { cn } from '@/lib/utils';

interface EvalStep {
  id: EvaluationStatus;
  label: string;
  detail: string;
}

const EVAL_STEPS: EvalStep[] = [
  { id: 'researching_executives', label: 'Researching Executives', detail: 'Searching regulatory filings, annual reports, and public records for the top leaders' },
  { id: 'analyzing_financials', label: 'Analyzing Financials', detail: 'Reviewing revenue growth, margins, ROIC, and capital allocation decisions' },
  { id: 'evaluating_cohesion', label: 'Mapping Team Dynamics', detail: 'Identifying shared work history, board overlaps, and insider patterns' },
  { id: 'scoring_team', label: 'Scoring Management Quality', detail: 'Generating 0–100 scores across five dimensions with evidence' },
];

const STEP_ORDER: EvaluationStatus[] = ['researching_executives', 'analyzing_financials', 'evaluating_cohesion', 'scoring_team', 'complete'];

function getStepState(step: EvaluationStatus, currentStatus: EvaluationStatus): 'done' | 'active' | 'pending' {
  const currentIdx = STEP_ORDER.indexOf(currentStatus);
  const stepIdx = STEP_ORDER.indexOf(step);
  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
}

const EvaluatePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const company = searchParams.get('company') || '';

  const [status, setStatus] = useState<EvaluationStatus>('idle');
  const [evaluation, setEvaluation] = useState<CompanyEvaluation | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status === 'idle' || status === 'complete' || status === 'error') return;
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const runEvaluation = useCallback(async () => {
    if (!company) return;
    setElapsed(0);
    try {
      const weights = getSavedWeights();
      const result = await evaluateCompany(company, weights, (s) => setStatus(s as EvaluationStatus));
      const finalEval = recalculateEvaluation(result, weights);
      saveEvaluation(finalEval);
      setEvaluation(finalEval);
      setStatus('complete');
    } catch (err: any) {
      console.error('Evaluation failed:', err);
      setStatus('error');
      toast({ title: 'Evaluation Failed', description: err?.message || 'Something went wrong.', variant: 'destructive' });
    }
  }, [company, toast]);

  useEffect(() => {
    if (company && status === 'idle') runEvaluation();
  }, [company, status, runEvaluation]);

  const handleReEvaluate = () => { setStatus('idle'); setEvaluation(null); };

  const handleWeightsChange = (newWeights: typeof DEFAULT_WEIGHTS) => {
    if (!evaluation) return;
    const updated = recalculateEvaluation(evaluation, newWeights);
    setEvaluation(updated);
    saveEvaluation(updated);
  };

  if (!company) { navigate('/'); return null; }

  // Loading screen
  if (status !== 'complete' || !evaluation) {
    const progressPct = status === 'error' ? 0 : (STEP_ORDER.indexOf(status) / (STEP_ORDER.length - 1)) * 100;

    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
          <div className="max-w-lg w-full px-6 space-y-8">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-primary/10 mb-2">
                <Loader2 className="h-7 w-7 text-primary animate-spin" />
              </div>
              <h2 className="text-xl font-semibold">Evaluating {company}</h2>
              <p className="text-sm text-muted-foreground">
                {elapsed > 0 && (
                  <>
                    <span className="font-mono font-medium text-foreground">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
                    {' elapsed · '}
                  </>
                )}
                {elapsed < 30 && 'Gathering data from multiple sources…'}
                {elapsed >= 30 && elapsed < 60 && 'Enriching with financial filings & sentiment data…'}
                {elapsed >= 60 && elapsed < 120 && 'AI is analyzing and scoring — deep research takes time…'}
                {elapsed >= 120 && 'Still working — complex companies need thorough analysis…'}
              </p>
            </div>
            <Progress value={progressPct} className="h-2" />
            <div className="space-y-2.5">
              {EVAL_STEPS.map(step => {
                const state = status === 'error' ? 'pending' : getStepState(step.id, status);
                return (
                  <div
                    key={step.id}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-3 transition-all duration-300',
                      state === 'active' && 'border-primary/40 bg-primary/5',
                      state === 'done' && 'border-border/50 bg-muted/30',
                      state === 'pending' && 'border-border/30 opacity-40'
                    )}
                  >
                    <div className="mt-0.5">
                      {state === 'done' ? <CheckCircle2 className="h-5 w-5 text-accent" /> : state === 'active' ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> : <Circle className="h-5 w-5 text-muted-foreground/40" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', state === 'active' ? 'text-foreground' : 'text-muted-foreground')}>{step.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {status === 'error' && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button onClick={handleReEvaluate} variant="outline" className="gap-2"><RefreshCw className="h-4 w-4" />Try Again</Button>
                <Button onClick={() => navigate('/')} variant="ghost">Go Back</Button>
              </div>
            )}
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
        onReEvaluate={handleReEvaluate}
        onEnrichmentComplete={(pairs: EnrichedCohesionPair[]) => {
          const updated = { ...evaluation, enrichedCohesion: pairs };
          setEvaluation(updated);
          saveEvaluation(updated);
        }}
      />
    </AppShell>
  );
};

export default EvaluatePage;
