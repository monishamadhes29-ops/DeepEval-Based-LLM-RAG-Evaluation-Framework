/**
 * DeepEval Metric types
 * - faithfulness: Output faithful to context
 * - answer_relevancy: Output relevant to query
 * - contextual_precision: Relevant nodes ranked higher than irrelevant nodes
 * - contextual_recall: Context contains info to answer expected_output
 * - pii_leakage: Detects personally identifiable information in output
 * - bias: Detects bias in LLM outputs
 * - hallucination: Detects hallucinations in LLM outputs by comparing with context
 * - toxicity: Detects toxic language (hate speech, insults, threats) in LLM outputs
 */
export type MetricOption =
  | 'faithfulness'
  | 'answer_relevancy'
  | 'contextual_precision'
  | 'contextual_recall'
  | 'pii_leakage'
  | 'bias'
  | 'hallucination'
  | 'toxicity';

/**
 * Form state for LLM evaluation (DeepEval provider)
 * `metric` is an array to support selecting multiple metrics in one evaluation run.
 */
export interface FormState {
  metric: MetricOption[];
  query: string;
  output: string;
  context: string[];
  expected_output?: string;
}

/**
 * Validation error messages
 */
export interface FormValidationErrors {
  provider?: string;
  metric?: string;
  query?: string;
  output?: string;
  context?: string;
  expected_output?: string;
}

/**
 * Per-claim faithfulness verdict, part of the claim-level breakdown DeepEval
 * returns for the `faithfulness` metric.
 */
export interface ClaimVerdict {
  claim: string;
  verdict: string; // 'yes' | 'no' | 'idk'
  reason?: string | null;
}

/**
 * Claim-level faithfulness breakdown: the truths extracted from context, the
 * claims extracted from the output, and a per-claim supported/contradicted/
 * ambiguous verdict, plus aggregate counts.
 */
export interface FaithfulnessDetail {
  truths: string[];
  claims: string[];
  verdicts: ClaimVerdict[];
  idk_count: number;
  yes_count: number;
  no_count: number;
}

/**
 * Token usage + estimated cost for the LLM call(s) behind one metric evaluation
 * (or, as `totalUsage` on the response, aggregated across every metric evaluated).
 * Cost is a rough estimate (see PRICE_PER_1K_*_TOKENS in the DeepEval sidecar's .env).
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
}

/**
 * Single metric result, used both for the legacy single-metric response
 * and as an entry in `results` when multiple metrics are evaluated at once.
 */
export interface MetricResultEntry {
  metric_name: string;
  score?: number | null;
  verdict?: string | null;
  explanation?: string | null;
  error?: string | null;
  detail?: FaithfulnessDetail | null;
  usage?: TokenUsage | null;
}

/**
 * LLM Evaluation response (DeepEval format)
 */
export interface LLMEvalResponse {
  metric?: MetricOption | 'all' | string;
  metric_name?: string;
  query?: string;
  output?: string;
  context?: string[];
  score: number;
  verdict?: string;
  explanation: string;
  reference_used?: string;
  /** True when multiple metrics were requested (multi-select or "all") — render `results` instead of the top-level fields. */
  allMetrics?: boolean;
  totalMetrics?: number;
  results?: MetricResultEntry[];
  detail?: FaithfulnessDetail | null;
  usage?: TokenUsage | null;
  totalUsage?: TokenUsage | null;
}

/**
 * API error response
 */
export interface ApiError {
  message: string;
  status?: number;
  details?: string;
}
