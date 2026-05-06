import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScoringWeights, DIMENSION_LABELS, WEIGHT_PRESETS, ScoringDimension } from '@/types/evaluation';
import { saveWeights } from '@/lib/storage';
import { RefreshCw } from 'lucide-react';

interface Props {
  weights: ScoringWeights;
  onChange: (weights: ScoringWeights) => void;
  onReEvaluate?: () => void;
}

const DIMENSIONS: ScoringDimension[] = [
  'tenure_stability',
  'execution_track_record',
  'capital_allocation',
  'insider_alignment',
  'team_cohesion',
];

export const WeightsPanel = ({ weights, onChange, onReEvaluate }: Props) => {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const handleDimensionChange = (dimension: ScoringDimension, value: number) => {
    const newWeights = { ...weights, [dimension]: value };
    onChange(newWeights);
    saveWeights(newWeights);
  };

  const applyPreset = (preset: typeof WEIGHT_PRESETS[0]) => {
    onChange(preset.weights);
    saveWeights(preset.weights);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Weight Configuration</h3>
            <span className="text-xs text-muted-foreground font-mono">Total: {totalWeight}</span>
          </div>

          <div className="space-y-4">
            {DIMENSIONS.map(dim => (
              <div key={dim} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">{DIMENSION_LABELS[dim]}</label>
                  <span className="text-xs font-mono text-muted-foreground">{weights[dim]}%</span>
                </div>
                <Slider
                  value={[weights[dim]]}
                  onValueChange={([val]) => handleDimensionChange(dim, val)}
                  min={0}
                  max={50}
                  step={5}
                  className="w-full"
                />
              </div>
            ))}
          </div>

          {onReEvaluate && (
            <Button onClick={onReEvaluate} className="w-full gap-2 mt-2" variant="default">
              <RefreshCw className="h-4 w-4" />
              Re-evaluate with AI
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Presets</h4>
          {WEIGHT_PRESETS.map(preset => (
            <Button
              key={preset.name}
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs h-auto py-2"
              onClick={() => applyPreset(preset)}
            >
              <div className="text-left">
                <p className="font-medium">{preset.name}</p>
                <p className="text-muted-foreground font-normal">{preset.description}</p>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
