/**
 * Custom Metrics (G-Eval) types.
 *
 * A custom metric is a user-defined criteria evaluated via DeepEval's GEval
 * (https://deepeval.com/docs/metrics-llm-evals) - unlike the built-in metrics in
 * ../LLMEval/types.ts, its scoring mechanism (criteria/threshold) is configurable rather
 * than fixed.
 */
export interface CustomMetricFormState {
  metric_name: string; // which custom G-Eval preset, e.g. 'correctness'
  query: string;
  output: string;
  expected_output: string;
  context: string[];
  criteria: string; // configurable scoring mechanism - editable, prefilled from backend config
  threshold: number; // configurable pass/fail cutoff for this evaluation
}

/**
 * Env-resolved default scoring configuration for a custom G-Eval metric, fetched from
 * GET /api/custom-metrics/config so the form can prefill an editable criteria/threshold.
 */
export interface CustomMetricConfig {
  metric_name: string;
  criteria: string;
  evaluation_params: string[];
  threshold: number;
  verdict_high: number;
  verdict_low: number;
}

export interface CustomMetricValidationErrors {
  output?: string;
  criteria?: string;
  threshold?: string;
}
