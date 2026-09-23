import React, { useEffect, useState } from 'react';
import { LLMEvalResponse, ApiError } from '../LLMEval/types';
import { ContextList } from '../LLMEval/ContextList';
import { ResponsePanel } from '../LLMEval/ResponsePanel';
import { CustomMetricFormState, CustomMetricValidationErrors } from './types';
import {
  fetchCustomMetricsFeature,
  fetchCustomMetricConfig,
  evaluateCustomGEval,
  FALLBACK_CUSTOM_METRICS,
} from '../../services/customMetricsApi';

const label = (metric: string) => metric.charAt(0).toUpperCase() + metric.slice(1).replace(/_/g, ' ');

export const CustomMetricsForm: React.FC = () => {
  const [availableMetrics, setAvailableMetrics] = useState<string[]>(FALLBACK_CUSTOM_METRICS);
  // Which custom metric checkbox(es) are selected to run - 'correctness' today.
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(FALLBACK_CUSTOM_METRICS);

  const [formState, setFormState] = useState<CustomMetricFormState>({
    metric_name: 'correctness',
    query: '',
    output: '',
    expected_output: '',
    context: [''],
    criteria: '',
    threshold: 0.5,
  });

  const [configLoaded, setConfigLoaded] = useState(false);
  // Which test-case fields the active metric's judge actually reads (from server config) -
  // drives whether the Context input is shown at all, so the form never offers a field
  // that silently has no effect on the score.
  const [evaluationParams, setEvaluationParams] = useState<string[]>([]);
  const [response, setResponse] = useState<LLMEvalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<CustomMetricValidationErrors>({});
  const [apiError, setApiError] = useState<ApiError | null>(null);

  useEffect(() => {
    // Feature-level ON/OFF is App.tsx's job (ENABLE_CUSTOM_METRICS gates this page's nav
    // tab entirely, same as ENABLE_SINGLE_TURN/ENABLE_MULTI_TURN) - this only needs the
    // available metric list for the checkbox menu.
    fetchCustomMetricsFeature().then(({ metrics }) => {
      const list = metrics.length > 0 ? metrics : FALLBACK_CUSTOM_METRICS;
      setAvailableMetrics(list);
      setSelectedMetrics(list);
    });
  }, []);

  useEffect(() => {
    fetchCustomMetricConfig(formState.metric_name)
      .then((config) => {
        setFormState((prev) => ({
          ...prev,
          criteria: config.criteria,
          threshold: config.threshold,
        }));
        setEvaluationParams(config.evaluation_params || []);
      })
      .finally(() => setConfigLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState.metric_name]);

  const handleMetricToggle = (metric: string, checked: boolean) => {
    setSelectedMetrics((prev) => (checked ? [...prev, metric] : prev.filter((m) => m !== metric)));
  };

  const handleContextChange = (newContext: string[]) => {
    setFormState((prev) => ({ ...prev, context: newContext }));
  };

  const validate = (): CustomMetricValidationErrors => {
    const nextErrors: CustomMetricValidationErrors = {};
    if (!formState.output || !formState.output.trim()) {
      nextErrors.output = 'Output is required';
    }
    if (!formState.criteria || !formState.criteria.trim()) {
      nextErrors.criteria = 'Criteria is required (defines how this metric scores the output)';
    }
    if (formState.threshold < 0 || formState.threshold > 1) {
      nextErrors.threshold = 'Threshold must be between 0 and 1';
    }
    return nextErrors;
  };

  const handleEvaluate = async () => {
    setApiError(null);
    setResponse(null);

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsLoading(true);
    try {
      const result = await evaluateCustomGEval({
        metric_name: formState.metric_name,
        query: formState.query || undefined,
        output: formState.output,
        expected_output: formState.expected_output || undefined,
        context: contextUsedInScoring ? formState.context.filter((c) => c.trim().length > 0) : undefined,
        criteria: formState.criteria,
        threshold: formState.threshold,
      });
      setResponse(result);
    } catch (error) {
      setApiError(error as ApiError);
    } finally {
      setIsLoading(false);
    }
  };

  const evaluateDisabled = selectedMetrics.length === 0 || isLoading;
  // Only show the Context input if the active metric's configured evaluation_params
  // actually reads it - otherwise it's a field that silently has no effect on the score.
  const contextUsedInScoring = evaluationParams.includes('context') || evaluationParams.includes('retrieval_context');

  return (
    <div className="llm-eval-form-container">
      <div className="llm-eval-framework-banner">
        <div className="llm-eval-framework-badge">
          <span className="llm-eval-framework-label">Active Framework:</span>
          <span className="llm-eval-framework-name">🧩 DeepEval G-Eval (Custom)</span>
        </div>
      </div>

      {/* Metric checkbox menu */}
      <div className="llm-eval-form-group">
        <label className="llm-eval-form-label">
          Custom Metrics
          <span className="llm-eval-required">*</span>
        </label>
        <div className="llm-eval-metric-checkbox-group">
          {availableMetrics.map((metric) => (
            <label key={metric} className="llm-eval-metric-checkbox-item">
              <input
                type="checkbox"
                checked={selectedMetrics.includes(metric)}
                onChange={(e) => handleMetricToggle(metric, e.target.checked)}
              />
              <span>{label(metric)}</span>
            </label>
          ))}
        </div>
      </div>

      <>
        {/* Configurable scoring mechanism */}
        <div className="llm-eval-form-group expected-output-group">
          <label htmlFor="criteria" className="llm-eval-form-label expected-output-label">
            Scoring Criteria (configurable)
            <span className="llm-eval-required">*</span>
            <span className="label-info">
              {configLoaded ? 'Prefilled from server config - edit to change how this metric scores the output' : 'Loading default criteria…'}
            </span>
          </label>
          <textarea
            id="criteria"
            className={`llm-eval-input llm-eval-textarea expected-output-textarea ${errors.criteria ? 'llm-eval-input-error' : ''}`}
            rows={4}
            value={formState.criteria}
            onChange={(e) => setFormState((prev) => ({ ...prev, criteria: e.target.value }))}
          />
          {errors.criteria && <span className="llm-eval-error-message">{errors.criteria}</span>}
        </div>

        <div className="llm-eval-form-group">
          <label htmlFor="threshold" className="llm-eval-form-label">
            Pass Threshold (configurable)
          </label>
          <input
            id="threshold"
            type="number"
            min={0}
            max={1}
            step={0.05}
            className={`llm-eval-input ${errors.threshold ? 'llm-eval-input-error' : ''}`}
            value={formState.threshold}
            onChange={(e) => setFormState((prev) => ({ ...prev, threshold: parseFloat(e.target.value) }))}
          />
          {errors.threshold && <span className="llm-eval-error-message">{errors.threshold}</span>}
        </div>

        {/* Query */}
        <div className="llm-eval-form-group">
          <label htmlFor="cm-query" className="llm-eval-form-label">Query/User Input</label>
          <input
            id="cm-query"
            type="text"
            className="llm-eval-input"
            placeholder="Enter your query here (optional)"
            value={formState.query}
            onChange={(e) => setFormState((prev) => ({ ...prev, query: e.target.value }))}
          />
        </div>

        {/* Output */}
        <div className="llm-eval-form-group">
          <label htmlFor="cm-output" className="llm-eval-form-label">
            LLM Output/Actual output from LLM
            <span className="llm-eval-required">*</span>
          </label>
          <textarea
            id="cm-output"
            className={`llm-eval-input llm-eval-textarea ${errors.output ? 'llm-eval-input-error' : ''}`}
            placeholder="Enter the output/response here"
            rows={4}
            value={formState.output}
            onChange={(e) => setFormState((prev) => ({ ...prev, output: e.target.value }))}
          />
          {errors.output && <span className="llm-eval-error-message">{errors.output}</span>}
        </div>

        {/* Expected Output */}
        <div className="llm-eval-form-group expected-output-group">
          <label htmlFor="cm-expected" className="llm-eval-form-label expected-output-label">
            Expected Output
            <span className="label-info">(Used by the Correctness criteria to judge factual accuracy)</span>
          </label>
          <textarea
            id="cm-expected"
            className="llm-eval-input llm-eval-textarea expected-output-textarea"
            placeholder="Enter the expected/reference answer here (optional)"
            rows={4}
            value={formState.expected_output}
            onChange={(e) => setFormState((prev) => ({ ...prev, expected_output: e.target.value }))}
          />
        </div>

        {/* Context - only shown when the active metric's scoring config actually reads it */}
        {contextUsedInScoring && (
          <ContextList
            context={formState.context}
            onContextChange={handleContextChange}
            contextRequired={false}
          />
        )}

        <button
          className="llm-eval-btn llm-eval-btn-evaluate"
          onClick={handleEvaluate}
          disabled={evaluateDisabled}
        >
          {isLoading ? '⏳ Evaluating...' : '✨ Click for Evaluation'}
        </button>
      </>

      {apiError && (
        <div className="llm-eval-error-alert">
          <div className="llm-eval-error-header">
            <span className="llm-eval-error-icon">⚠️</span>
            <span className="llm-eval-error-title">Evaluation Failed</span>
          </div>
          <div className="llm-eval-error-message-box">{apiError.message}</div>
          {apiError.details && <div className="llm-eval-error-details">{apiError.details}</div>}
          {apiError.status && <div className="llm-eval-error-status">Status Code: {apiError.status}</div>}
        </div>
      )}

      <ResponsePanel response={response} isLoading={isLoading} />
    </div>
  );
};
