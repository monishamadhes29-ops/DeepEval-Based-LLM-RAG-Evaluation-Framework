import axios, { AxiosError } from 'axios';
import { LLMEvalResponse, ApiError } from '../components/LLMEval/types';
import { CustomMetricConfig } from '../components/CustomMetrics/types';

const BACKEND_URL = 'http://localhost:3001';

export interface CustomMetricsFeature {
  enabled: boolean;
  metrics: string[];
}

// Used if the backend is unreachable, so the menu still renders something usable.
export const FALLBACK_CUSTOM_METRICS = ['correctness', 'fairness'];

/**
 * Whether the Custom Metrics (G-Eval) feature is enabled, plus the available metric presets
 * for the checkbox menu (e.g. 'correctness').
 */
export const fetchCustomMetricsFeature = async (): Promise<CustomMetricsFeature> => {
  try {
    const response = await axios.get<CustomMetricsFeature>(`${BACKEND_URL}/api/custom-metrics`);
    return response.data;
  } catch (error) {
    console.warn('⚠️ Could not fetch custom metrics feature flag, using fallback:', error);
    return { enabled: true, metrics: FALLBACK_CUSTOM_METRICS };
  }
};

/**
 * Current (env-resolved) scoring configuration for a custom G-Eval metric - lets the form
 * prefill an editable criteria/threshold instead of hardcoding it client-side.
 */
export const fetchCustomMetricConfig = async (metricName: string = 'correctness'): Promise<CustomMetricConfig> => {
  const response = await axios.get<CustomMetricConfig>(`${BACKEND_URL}/api/custom-metrics/config`, {
    params: { metric_name: metricName },
  });
  return response.data;
};

/**
 * Evaluate a custom G-Eval metric via the dedicated /api/custom-metrics/geval endpoint
 * (STRICTLY separate from the built-in-metrics /api/eval-only endpoint).
 */
export const evaluateCustomGEval = async (payload: {
  metric_name: string;
  query?: string;
  output: string;
  expected_output?: string;
  context?: string[];
  criteria?: string;
  threshold?: number;
}): Promise<LLMEvalResponse> => {
  try {
    console.log('📤 Custom G-Eval Request:', payload);

    const response = await axios.post<LLMEvalResponse>(
      `${BACKEND_URL}/api/custom-metrics/geval`,
      payload,
      { timeout: 1200000 }
    );

    console.log('📥 Custom G-Eval Response:', response.data);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string; error?: string; detail?: string }>;

    console.error('❌ Custom G-Eval Error:', axiosError);

    const apiError: ApiError = {
      message: 'Failed to evaluate custom G-Eval metric',
      status: axiosError.response?.status,
      details:
        axiosError.response?.data?.detail ||
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        axiosError.message,
    };

    throw apiError;
  }
};
