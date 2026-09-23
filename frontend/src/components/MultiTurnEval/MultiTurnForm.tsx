import React, { useState, useEffect } from 'react';
import { MultiTurnFormState, MultiTurnResponse, MultiTurnValidationErrors, TurnInput, TurnRole, MultiTurnMetricOption } from './types';
import { ApiError } from '../LLMEval/types';
import { evaluateMultiTurn } from '../../services/llmEvalApi';
import { MultiTurnResponsePanel } from './MultiTurnResponsePanel';
import { fetchEnabledMetrics, FALLBACK_MULTI_TURN_METRICS } from '../../services/configApi';

const metricLabel = (metric: string): string =>
  metric.charAt(0).toUpperCase() + metric.slice(1).replace(/_/g, ' ');

const defaultTurns: TurnInput[] = [
  { role: 'user', content: '' },
  { role: 'assistant', content: '' },
];

const validate = (formState: MultiTurnFormState): MultiTurnValidationErrors => {
  const errors: MultiTurnValidationErrors = {};

  if (formState.turns.length < 2) {
    errors.turns = 'At least 2 turns are required (e.g. one user turn and one assistant turn)';
  } else if (formState.turns.some((t) => !t.content.trim())) {
    errors.turns = 'All turns must have content';
  }

  if (formState.metric.length === 0) {
    errors.metric = 'Select at least one metric';
  }

  return errors;
};

export const MultiTurnForm: React.FC = () => {
  const [formState, setFormState] = useState<MultiTurnFormState>({
    turns: defaultTurns,
    metric: ['conversation_completeness'],
  });
  const [response, setResponse] = useState<MultiTurnResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<MultiTurnValidationErrors>({});
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [availableMetrics, setAvailableMetrics] = useState<string[]>(FALLBACK_MULTI_TURN_METRICS);

  useEffect(() => {
    fetchEnabledMetrics().then(({ multiTurn }) => {
      setAvailableMetrics(multiTurn);
      setFormState((prev) => {
        const stillEnabled = prev.metric.filter((m) => multiTurn.includes(m));
        if (stillEnabled.length === prev.metric.length) return prev;
        return { ...prev, metric: (stillEnabled.length > 0 ? stillEnabled : [multiTurn[0]]) as MultiTurnMetricOption[] };
      });
    });
  }, []);

  const handleTurnContentChange = (index: number, content: string) => {
    const turns = [...formState.turns];
    turns[index] = { ...turns[index], content };
    setFormState({ ...formState, turns });
    if (errors.turns) setErrors({ ...errors, turns: undefined });
  };

  const handleTurnRoleChange = (index: number, role: TurnRole) => {
    const turns = [...formState.turns];
    turns[index] = { ...turns[index], role };
    setFormState({ ...formState, turns });
  };

  const handleAddTurn = () => {
    const lastRole = formState.turns[formState.turns.length - 1]?.role;
    const nextRole: TurnRole = lastRole === 'user' ? 'assistant' : 'user';
    setFormState({ ...formState, turns: [...formState.turns, { role: nextRole, content: '' }] });
  };

  const handleDeleteTurn = (index: number) => {
    setFormState({ ...formState, turns: formState.turns.filter((_, i) => i !== index) });
  };

  const handleMetricToggle = (metric: MultiTurnMetricOption, checked: boolean) => {
    const nextMetrics = checked
      ? [...formState.metric, metric]
      : formState.metric.filter((m) => m !== metric);
    setFormState({ ...formState, metric: nextMetrics });
    if (errors.metric) setErrors({ ...errors, metric: undefined });
  };

  const handleEvaluate = async () => {
    setApiError(null);
    setResponse(null);

    const validationErrors = validate(formState);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsLoading(true);
    try {
      const result = await evaluateMultiTurn(formState);
      setResponse(result);
    } catch (error) {
      setApiError(error as ApiError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="llm-eval-form-container">
      <div className="llm-eval-framework-banner">
        <div className="llm-eval-framework-badge">
          <span className="llm-eval-framework-label">Active Framework:</span>
          <span className="llm-eval-framework-name">🔍 DeepEval (Multi-Turn)</span>
        </div>
      </div>

      {/* Metric Multi-Select */}
      <div className="llm-eval-form-group">
        <label className="llm-eval-form-label">
          Metrics
          <span className="llm-eval-required">*</span>
        </label>
        <div className={`llm-eval-metric-checkbox-group ${errors.metric ? 'llm-eval-input-error' : ''}`}>
          {availableMetrics.map((value) => (
            <label key={value} className="llm-eval-metric-checkbox-item">
              <input
                type="checkbox"
                checked={formState.metric.includes(value as MultiTurnMetricOption)}
                onChange={(e) => handleMetricToggle(value as MultiTurnMetricOption, e.target.checked)}
              />
              <span>{metricLabel(value)}</span>
            </label>
          ))}
        </div>
        {errors.metric && <span className="llm-eval-error-message">{errors.metric}</span>}
      </div>

      {/* Turn Builder */}
      <div className="llm-eval-form-group">
        <label className="llm-eval-form-label">
          Conversation Turns
          <span className="llm-eval-required">*</span>
        </label>
        <div className="multiturn-turn-list">
          {formState.turns.map((turn, index) => (
            <div key={index} className="multiturn-turn-item">
              <div className="multiturn-turn-header">
                <select
                  className="llm-eval-select multiturn-role-select"
                  value={turn.role}
                  onChange={(e) => handleTurnRoleChange(index, e.target.value as TurnRole)}
                >
                  <option value="user">User</option>
                  <option value="assistant">Assistant</option>
                </select>
                <button
                  type="button"
                  className="llm-eval-context-delete-btn"
                  onClick={() => handleDeleteTurn(index)}
                  title="Delete turn"
                  disabled={formState.turns.length <= 2}
                >
                  🗑️
                </button>
              </div>
              <textarea
                className="llm-eval-input llm-eval-textarea"
                placeholder={`Turn ${index + 1} content (${turn.role})`}
                rows={2}
                value={turn.content}
                onChange={(e) => handleTurnContentChange(index, e.target.value)}
              />
            </div>
          ))}
        </div>
        {errors.turns && <span className="llm-eval-error-message">{errors.turns}</span>}
        <button
          type="button"
          className="llm-eval-btn llm-eval-btn-primary llm-eval-add-context-btn"
          onClick={handleAddTurn}
        >
          + Add Turn
        </button>
      </div>

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
      <MultiTurnResponsePanel response={response} isLoading={isLoading} />
    </div>
  );
};
