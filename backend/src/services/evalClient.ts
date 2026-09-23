import axios from "axios";
import { ENV } from "../config/env.js";

export interface ClaimVerdict {
  claim: string;
  verdict: string; // "yes" | "no" | "idk"
  reason?: string | null;
}

export interface FaithfulnessDetail {
  truths: string[];
  claims: string[];
  verdicts: ClaimVerdict[];
  idk_count: number;
  yes_count: number;
  no_count: number;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
}

export interface MetricResult {
  metric_name: string;
  score?: number;
  verdict?: string;
  explanation?: string;
  error?: string | null;
  detail?: FaithfulnessDetail | null;
  usage?: TokenUsage | null;
}

export interface EvalResult {
  results: MetricResult[];
  metric_name?: string;
  score?: number;
  verdict?: string;
  explanation?: string;
  error?: string;
  total_usage?: TokenUsage | null;
}

/**
 * Evaluate with full control over all fields
 */
export async function evalWithFields(params: {
  query?: string;
  context?: string[];
  output?: string;
  expected_output?: string;
  metric?: string | string[];
  provider?: string;
}): Promise<EvalResult> {
  const payload: any = {
    metric: params.metric || "faithfulness",
  };

  // Contextual metrics (contextual_precision, contextual_recall) do not require output
  // They evaluate context quality based on expected_output
  const metricsNotRequiringOutput = ["contextual_precision", "contextual_recall"];
  const metricName = params.metric || "faithfulness";

  // For "all" metric or a multi-metric array, skip this blanket check - each metric has
  // its own requirements, so let the DeepEval service validate them individually and
  // report per-metric errors in `results[]` instead of failing the whole request here.
  if (
    typeof metricName === "string" &&
    metricName !== "all" &&
    !metricsNotRequiringOutput.includes(metricName) &&
    !params.output
  ) {
    throw new Error("output field is required");
  }
  
  // Only include output if it's provided
  if (params.output) {
    payload.output = params.output;
  }

  if (params.query) payload.query = params.query;
  if (params.context) payload.context = params.context;
  if (params.expected_output) payload.expected_output = params.expected_output;  // NEW: Pass expected_output
  if (params.provider) payload.provider = params.provider;

  console.log(`evalWithFields - Sending payload:`, JSON.stringify(payload, null, 2));

  try {
    const res = await axios.post<EvalResult>(ENV.DEEPEVAL_URL, payload);
    return res.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if ((err as any).code === "ECONNREFUSED") {
        throw new Error(
          `DeepEval service unavailable at ${ENV.DEEPEVAL_URL}. Is it running?`
        );
      }
      const errorDetail = err.response?.data?.detail || err.message;
      throw new Error(
        `DeepEval Error (${err.response?.status || 'unknown'}): ${errorDetail}`
      );
    }
    throw err;
  }
}

export interface TurnInput {
  role: "user" | "assistant";
  content: string;
  retrieval_context?: string[];
}

export interface GoldenResult {
  query: string;
  expected_output?: string;
  context?: string[];
}

export interface GenerateGoldensResult {
  goldens: GoldenResult[];
  totalGoldens: number;
  usage?: TokenUsage | null;
}

/**
 * Evaluate a multi-turn conversation (conversation_completeness, or "all")
 */
export async function evalMultiTurn(params: {
  turns: TurnInput[];
  metric?: string | string[];
  provider?: string;
}): Promise<EvalResult> {
  const payload: any = {
    turns: params.turns,
    metric: params.metric || "conversation_completeness",
  };
  if (params.provider) payload.provider = params.provider;

  console.log(`evalMultiTurn - Sending payload:`, JSON.stringify(payload, null, 2));

  try {
    const res = await axios.post<EvalResult>(ENV.DEEPEVAL_MULTITURN_URL, payload);
    return res.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if ((err as any).code === "ECONNREFUSED") {
        throw new Error(
          `DeepEval service unavailable at ${ENV.DEEPEVAL_MULTITURN_URL}. Is it running?`
        );
      }
      const errorDetail = err.response?.data?.detail || err.message;
      throw new Error(
        `DeepEval Error (${err.response?.status || 'unknown'}): ${errorDetail}`
      );
    }
    throw err;
  }
}

/**
 * Generate a synthetic golden dataset (query + expected_output + context) from source
 * documents/context using DeepEval's Synthesizer.
 */
export async function generateGoldens(params: {
  contexts: string[][];
  maxGoldensPerContext?: number;
  includeExpectedOutput?: boolean;
  provider?: string;
}): Promise<GenerateGoldensResult> {
  const payload: any = {
    contexts: params.contexts,
    max_goldens_per_context: params.maxGoldensPerContext ?? 2,
    include_expected_output: params.includeExpectedOutput ?? true,
  };
  if (params.provider) payload.provider = params.provider;

  console.log(`generateGoldens - Sending payload:`, JSON.stringify(payload, null, 2));

  try {
    const res = await axios.post<GenerateGoldensResult>(ENV.DEEPEVAL_GENERATE_GOLDENS_URL, payload);
    return res.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if ((err as any).code === "ECONNREFUSED") {
        throw new Error(
          `DeepEval service unavailable at ${ENV.DEEPEVAL_GENERATE_GOLDENS_URL}. Is it running?`
        );
      }
      const errorDetail = err.response?.data?.detail || err.message;
      throw new Error(
        `DeepEval Error (${err.response?.status || 'unknown'}): ${errorDetail}`
      );
    }
    throw err;
  }
}

export interface CustomGEvalConfig {
  metric_name: string;
  criteria: string;
  evaluation_params: string[];
  threshold: number;
  verdict_high: number;
  verdict_low: number;
}

/**
 * Custom G-Eval metric evaluation - STRICTLY separate from evalWithFields()/the built-in
 * /eval endpoint. Criteria/evaluation_steps/threshold are configurable (env-default, with
 * optional per-request override), same as every built-in metric's threshold.
 */
export async function evalCustomGEval(params: {
  metric_name?: string;
  query?: string;
  output: string;
  expected_output?: string;
  context?: string[];
  criteria?: string;
  evaluation_steps?: string[];
  threshold?: number;
  provider?: string;
}): Promise<EvalResult> {
  if (!params.output) {
    throw new Error("output field is required for custom G-Eval metrics");
  }

  const payload: any = {
    metric_name: params.metric_name || "correctness",
    output: params.output,
  };
  if (params.query) payload.query = params.query;
  if (params.expected_output) payload.expected_output = params.expected_output;
  if (params.context) payload.context = params.context;
  if (params.criteria) payload.criteria = params.criteria;
  if (params.evaluation_steps) payload.evaluation_steps = params.evaluation_steps;
  if (params.threshold !== undefined) payload.threshold = params.threshold;
  if (params.provider) payload.provider = params.provider;

  console.log(`evalCustomGEval - Sending payload:`, JSON.stringify(payload, null, 2));

  try {
    const res = await axios.post<EvalResult>(ENV.DEEPEVAL_CUSTOM_GEVAL_URL, payload);
    return res.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if ((err as any).code === "ECONNREFUSED") {
        throw new Error(
          `DeepEval service unavailable at ${ENV.DEEPEVAL_CUSTOM_GEVAL_URL}. Is it running?`
        );
      }
      const errorDetail = err.response?.data?.detail || err.message;
      throw new Error(
        `DeepEval Error (${err.response?.status || 'unknown'}): ${errorDetail}`
      );
    }
    throw err;
  }
}

/**
 * Current env-resolved default criteria/threshold/evaluation_params for a custom G-Eval
 * metric - lets the frontend prefill an editable "scoring mechanism" form.
 */
export async function getCustomGEvalConfig(metricName: string = "correctness"): Promise<CustomGEvalConfig> {
  const res = await axios.get<CustomGEvalConfig>(ENV.DEEPEVAL_CUSTOM_METRICS_CONFIG_URL, {
    params: { metric_name: metricName },
  });
  return res.data;
}

/**
 * Canonical list of custom G-Eval metric presets the DeepEval sidecar supports (e.g. 'correctness').
 */
export async function getSupportedCustomMetrics(): Promise<string[]> {
  const res = await axios.get<{ custom: string[] }>(ENV.DEEPEVAL_CUSTOM_METRICS_LIST_URL);
  return res.data.custom;
}

export interface SupportedMetrics {
  singleTurn: string[];
  multiTurn: string[];
}

/**
 * Canonical (unfiltered) list of metric names the DeepEval sidecar supports.
 * DISABLED_METRICS filtering happens on the backend gateway side, not here.
 */
export async function getSupportedMetrics(): Promise<SupportedMetrics> {
  const res = await axios.get<{ single_turn: string[]; multi_turn: string[] }>(ENV.DEEPEVAL_METRICS_URL);
  return {
    singleTurn: res.data.single_turn,
    multiTurn: res.data.multi_turn,
  };
}

