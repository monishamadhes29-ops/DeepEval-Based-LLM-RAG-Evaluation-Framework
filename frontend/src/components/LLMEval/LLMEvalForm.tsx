import React, { useState, useEffect } from 'react';
import { FormState, LLMEvalResponse, FormValidationErrors, ApiError } from './types';
import { validateForm, isFormValid, shouldShowExpectedOutput, isContextRequired, shouldShowLLMOutput } from './validation';
import { ContextList } from './ContextList';
import { ResponsePanel } from './ResponsePanel';
import { evaluateLLM } from '../../services/llmEvalApi';
import { fetchEnabledMetrics, FALLBACK_SINGLE_TURN_METRICS } from '../../services/configApi';

interface LLMEvalFormProps {
  onEvaluate?: (formData: FormState) => void;
}

export const LLMEvalForm: React.FC<LLMEvalFormProps> = ({ onEvaluate }) => {
  const [formState, setFormState] = useState<FormState>({
    metric: ['faithfulness'],
    query: '',
    output: '',
    context: [''],
    expected_output: '',
  });

  const [response, setResponse] = useState<LLMEvalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormValidationErrors>({});
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [availableMetrics, setAvailableMetrics] = useState<string[]>(FALLBACK_SINGLE_TURN_METRICS);

  useEffect(() => {
    fetchEnabledMetrics().then(({ singleTurn }) => {
      setAvailableMetrics(singleTurn);
      // Drop any currently-selected metric that's no longer enabled (e.g. disabled via .env)
      setFormState((prev) => {
        const stillEnabled = prev.metric.filter((m) => singleTurn.includes(m));
        if (stillEnabled.length === prev.metric.length) return prev;
        return { ...prev, metric: (stillEnabled.length > 0 ? stillEnabled : [singleTurn[0]]) as FormState['metric'] };
      });
    });
  }, []);

  const showExpectedOutput = shouldShowExpectedOutput(formState.metric);
  const contextRequired = isContextRequired(formState.metric);
  const showLLMOutput = shouldShowLLMOutput(formState.metric);

  const handleMetricToggle = (metric: string, checked: boolean) => {
    const nextMetrics = checked
      ? [...formState.metric, metric]
      : formState.metric.filter((m) => m !== metric);

    setFormState({
      ...formState,
      metric: nextMetrics as FormState['metric'],
    });
    // Clear metric error
    if (errors.metric) {
      const newErrors = { ...errors };
      delete newErrors.metric;
      setErrors(newErrors);
    }
  };

  const allMetricsSelected =
    availableMetrics.length > 0 &&
    availableMetrics.every((m) => formState.metric.includes(m as FormState['metric'][number]));

  const handleSelectAllToggle = (checked: boolean) => {
    setFormState({
      ...formState,
      metric: (checked ? [...availableMetrics] : []) as FormState['metric'],
    });
    if (errors.metric) {
      const newErrors = { ...errors };
      delete newErrors.metric;
      setErrors(newErrors);
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormState({
      ...formState,
      query: e.target.value,
    });
    // Clear query error
    if (errors.query) {
      const newErrors = { ...errors };
      delete newErrors.query;
      setErrors(newErrors);
    }
  };

  const handleOutputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormState({
      ...formState,
      output: e.target.value,
    });
    // Clear output error
    if (errors.output) {
      const newErrors = { ...errors };
      delete newErrors.output;
      setErrors(newErrors);
    }
  };

  const handleExpectedOutputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormState({
      ...formState,
      expected_output: e.target.value,
    });
    // Clear expected_output error if present
    if (errors.expected_output) {
      const newErrors = { ...errors };
      delete newErrors.expected_output;
      setErrors(newErrors);
    }
  };

  const handleContextChange = (newContext: string[]) => {
    setFormState({
      ...formState,
      context: newContext,
    });
    // Clear context errors
    if (errors.context) {
      const newErrors = { ...errors };
      delete newErrors.context;
      setErrors(newErrors);
    }
  };

  const handleAddContext = () => {
    setFormState({
      ...formState,
      context: [...formState.context, ''],
    });
  };

  const handleEvaluate = async () => {
    setApiError(null);
    setResponse(null);

    const validationErrors = validateForm(formState);
    setErrors(validationErrors);

    if (!isFormValid(validationErrors)) {
      console.log('Form validation failed:', validationErrors);
      return;
    }

    setIsLoading(true);

    try {
      console.log('📊 Starting LLM evaluation with DeepEval...');
      const result = await evaluateLLM(formState);
      console.log('✅ LLM Evaluation successful:', result);
      setResponse(result);
    } catch (error) {
      const err = error as ApiError;
      console.error('❌ LLM Evaluation error:', err);
      setApiError(err);
    } finally {
      setIsLoading(false);
    }

    onEvaluate?.(formState);
  };

  return (
    <div className="llm-eval-form-container">
      {/* Framework Name Display Banner */}
      <div className="llm-eval-framework-banner">
        <div className="llm-eval-framework-badge">
          <span className="llm-eval-framework-label">Active Framework:</span>
          <span className="llm-eval-framework-name">🔍 DeepEval</span>
        </div>
      </div>

      {/* Metric Multi-Select */}
      <div className="llm-eval-form-group">
        <label className="llm-eval-form-label">
          Metrics
          <span className="llm-eval-required">*</span>
        </label>
        <div className={`llm-eval-metric-checkbox-group ${errors.metric ? 'llm-eval-input-error' : ''}`}>
          <label className="llm-eval-metric-checkbox-item llm-eval-metric-checkbox-all">
            <input
              type="checkbox"
              checked={allMetricsSelected}
              onChange={(e) => handleSelectAllToggle(e.target.checked)}
            />
            <span>All</span>
          </label>
          {availableMetrics.map((metric) => (
            <label key={metric} className="llm-eval-metric-checkbox-item">
              <input
                type="checkbox"
                checked={formState.metric.includes(metric as FormState['metric'][number])}
                onChange={(e) => handleMetricToggle(metric, e.target.checked)}
              />
              <span>{metric.charAt(0).toUpperCase() + metric.slice(1).replace(/_/g, ' ')}</span>
            </label>
          ))}
        </div>
        {errors.metric && (
          <span className="llm-eval-error-message">{errors.metric}</span>
        )}
      </div>

      {/* Query Input */}
      <div className="llm-eval-form-group">
        <label htmlFor="query" className="llm-eval-form-label">
          Query/User Input
          <span className="llm-eval-required">*</span>
        </label>
        <input
          id="query"
          type="text"
          className={`llm-eval-input ${errors.query ? 'llm-eval-input-error' : ''}`}
          placeholder="Enter your query here"
          value={formState.query}
          onChange={handleQueryChange}
        />
        {errors.query && (
          <span className="llm-eval-error-message">{errors.query}</span>
        )}
      </div>

      {/* Output Textarea */}
      {showLLMOutput && (
        <div className="llm-eval-form-group">
          <label htmlFor="output" className="llm-eval-form-label">
            LLM Output/Actual output from LLM
            <span className="llm-eval-required">*</span>
          </label>
          <textarea
            id="output"
            className={`llm-eval-input llm-eval-textarea ${errors.output ? 'llm-eval-input-error' : ''}`}
            placeholder="Enter the output/response here"
            rows={4}
            value={formState.output}
            onChange={handleOutputChange}
          />
          {errors.output && (
            <span className="llm-eval-error-message">{errors.output}</span>
          )}
        </div>
      )}

      {/* Expected Output - For DeepEval contextual_recall and contextual_precision */}
      {showExpectedOutput && (
        <div className="llm-eval-form-group expected-output-group">
          <label htmlFor="expected_output" className="llm-eval-form-label expected-output-label">
            Expected Output <span className="llm-eval-required">*</span>
            <span className="label-info">
              (Required for Contextual Precision and Contextual Recall metrics)
            </span>
          </label>
          <textarea
            id="expected_output"
            className={`llm-eval-input llm-eval-textarea expected-output-textarea ${errors.expected_output ? 'llm-eval-input-error' : ''}`}
            placeholder="Enter the expected/reference answer here"
            rows={4}
            value={formState.expected_output || ''}
            onChange={handleExpectedOutputChange}
          />
          {errors.expected_output && (
            <span className="llm-eval-error-message">{errors.expected_output}</span>
          )}
        </div>
      )}

      {/* Context List */}
      <ContextList
        context={formState.context}
        onContextChange={handleContextChange}
        errors={errors.context ? [errors.context] : []}
        contextRequired={contextRequired}
      />

      {/* Evaluate Button */}
      <button
        className="llm-eval-btn llm-eval-btn-evaluate"
        onClick={handleEvaluate}
        disabled={isLoading}
      >
        {isLoading ? '⏳ Evaluating...' : '✨ Click for Evaluation'}
      </button>

      {/* API Error Display */}
      {apiError && (
        <div className="llm-eval-error-alert">
          <div className="llm-eval-error-header">
            <span className="llm-eval-error-icon">⚠️</span>
            <span className="llm-eval-error-title">Evaluation Failed</span>
          </div>
          <div className="llm-eval-error-message-box">{apiError.message}</div>
          {apiError.details && (
            <div className="llm-eval-error-details">{apiError.details}</div>
          )}
          {apiError.status && (
            <div className="llm-eval-error-status">Status Code: {apiError.status}</div>
          )}
        </div>
      )}

      {/* Response Panel */}
      <ResponsePanel response={response} isLoading={isLoading} />
    </div>
  );
};
