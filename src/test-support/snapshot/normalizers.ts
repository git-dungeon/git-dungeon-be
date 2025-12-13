import type { SimulationResult, SimulationStep } from '../../simulation/types';

type NormalizedStep = Omit<SimulationStep, 'logs'> & {
  logs: Array<{
    action: string;
    status: string;
    delta: unknown;
    extra: unknown;
  }>;
};

export type NormalizedResult = Omit<SimulationResult, 'steps'> & {
  steps: NormalizedStep[];
};

const normalizeSummary = (
  summary: SimulationResult['summary'],
): SimulationResult['summary'] => ({
  ...summary,
  durationMs: 0,
});

const stripDates = (value: unknown): unknown => {
  if (value instanceof Date) return '<DATE>';
  if (Array.isArray(value)) return value.map(stripDates);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, stripDates(v)]),
    );
  }
  return value;
};

export const normalizeResult = (result: SimulationResult): NormalizedResult => {
  const steps: NormalizedStep[] = result.steps.map((step) => ({
    ...step,
    logs: step.logs.map((log) => ({
      action: log.action,
      status: log.status,
      delta: stripDates(log.delta),
      extra: stripDates(log.extra),
    })),
  }));

  return {
    ...result,
    summary: normalizeSummary(result.summary),
    steps,
  };
};
