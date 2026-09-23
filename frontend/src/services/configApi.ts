import axios from 'axios';

const BACKEND_URL = 'http://localhost:3001';

export interface EnabledMetrics {
  singleTurn: string[];
  multiTurn: string[];
}

// Used if the backend is unreachable, so dropdowns still render something usable
// rather than breaking. Mirrors the backend's own fallback list in evalRoutes.ts.
export const FALLBACK_SINGLE_TURN_METRICS = [
  'faithfulness', 'answer_relevancy', 'contextual_precision', 'contextual_recall',
  'pii_leakage', 'bias', 'hallucination', 'toxicity'
];
export const FALLBACK_MULTI_TURN_METRICS = ['conversation_completeness'];

/**
 * Fetch the currently-enabled metric names (DISABLED_METRICS-filtered) from the backend.
 * Falls back to the hardcoded defaults above if the request fails.
 */
export const fetchEnabledMetrics = async (): Promise<EnabledMetrics> => {
  try {
    const response = await axios.get<EnabledMetrics>(`${BACKEND_URL}/api/config/metrics`);
    return response.data;
  } catch (error) {
    console.warn('⚠️ Could not fetch enabled metrics from backend, using fallback list:', error);
    return {
      singleTurn: FALLBACK_SINGLE_TURN_METRICS,
      multiTurn: FALLBACK_MULTI_TURN_METRICS,
    };
  }
};
