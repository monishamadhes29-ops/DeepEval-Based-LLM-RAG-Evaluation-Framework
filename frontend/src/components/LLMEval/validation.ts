import { FormState, FormValidationErrors } from './types';

const METRICS_NOT_REQUIRING_OUTPUT = ['contextual_precision', 'contextual_recall'];
const METRICS_REQUIRING_CONTEXT = ['faithfulness', 'contextual_precision', 'contextual_recall', 'hallucination', 'ragas'];
const METRICS_REQUIRING_EXPECTED_OUTPUT = ['contextual_precision', 'contextual_recall', 'ragas'];

export const validateForm = (formData: FormState): FormValidationErrors => {
  const errors: FormValidationErrors = {};
  const selectedMetrics = formData.metric || [];

  // Validate metric
  if (selectedMetrics.length === 0) {
    errors.metric = 'Select at least one metric';
  }

  // Validate query
  if (!formData.query || !formData.query.trim()) {
    errors.query = 'Query is required';
  }

  // Validate output - required if ANY selected metric needs it
  const anyMetricNeedsOutput = selectedMetrics.some((m) => !METRICS_NOT_REQUIRING_OUTPUT.includes(m));
  if (anyMetricNeedsOutput) {
    if (!formData.output || !formData.output.trim()) {
      errors.output = 'Output is required';
    }
  }

  // Validate context - required if ANY selected metric needs it
  const validContexts = formData.context.filter((ctx) => ctx && ctx.trim().length > 0);
  const anyMetricNeedsContext = selectedMetrics.some((m) => METRICS_REQUIRING_CONTEXT.includes(m));

  if (anyMetricNeedsContext) {
    if (validContexts.length === 0) {
      errors.context = 'At least one context item is required for the selected metric(s)';
    } else {
      const emptyContexts = formData.context.filter((ctx) => !ctx || !ctx.trim());
      if (emptyContexts.length > 0) {
        errors.context = `${emptyContexts.length} context item(s) are empty`;
      }
    }
  }

  // expected_output validation - required if ANY selected metric needs it
  const anyMetricNeedsExpectedOutput = selectedMetrics.some((m) => METRICS_REQUIRING_EXPECTED_OUTPUT.includes(m));
  if (anyMetricNeedsExpectedOutput) {
    if (!formData.expected_output || !formData.expected_output.trim()) {
      errors.expected_output = 'Expected output is required for the selected metric(s)';
    }
  }

  return errors;
};

export const isFormValid = (errors: FormValidationErrors): boolean => {
  return Object.keys(errors).length === 0;
};

/**
 * Check if expected_output field should be shown - true if any selected metric requires it
 */
export const shouldShowExpectedOutput = (metrics: string[]): boolean => {
  return metrics.some((m) => METRICS_REQUIRING_EXPECTED_OUTPUT.includes(m));
};

/**
 * Check if LLM output field should be shown - true if any selected metric uses output
 */
export const shouldShowLLMOutput = (metrics: string[]): boolean => {
  return metrics.some((m) => !METRICS_NOT_REQUIRING_OUTPUT.includes(m));
};

/**
 * Check if context field is required - true if any selected metric requires it
 */
export const isContextRequired = (metrics: string[]): boolean => {
  return metrics.some((m) => METRICS_REQUIRING_CONTEXT.includes(m));
};
