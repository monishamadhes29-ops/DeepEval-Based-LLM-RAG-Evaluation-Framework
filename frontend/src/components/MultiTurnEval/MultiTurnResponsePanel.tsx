import React, { useState } from 'react';
import { MultiTurnResponse } from './types';
import { MetricResultCard, getVerdictClass, TokenUsageDisplay } from '../LLMEval/ResponsePanel';

interface MultiTurnResponsePanelProps {
  response: MultiTurnResponse | null;
  isLoading: boolean;
}

export const MultiTurnResponsePanel: React.FC<MultiTurnResponsePanelProps> = ({ response, isLoading }) => {
  const [allExpanded, setAllExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className="llm-eval-response-panel">
        <h3 className="llm-eval-response-title">Response</h3>
        <div className="llm-eval-loading-container">
          <div className="llm-eval-loader"></div>
          <span className="llm-eval-loading-text">Evaluating conversation...</span>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="llm-eval-response-panel">
        <h3 className="llm-eval-response-title">Response</h3>
        <div className="llm-eval-placeholder-text">Click "Evaluate" to see results</div>
      </div>
    );
  }

  const isMultiMetric =
    Array.isArray(response.results) &&
    response.results.length > 0 &&
    (response.allMetrics || response.results.length > 1);

  const score = response.score ?? null;
  const metricName = String(response.metric_name || response.metric || 'Unknown Metric').replace(/_/g, ' ');

  return (
    <div className="llm-eval-response-panel">
      <div className="llm-eval-response-header-row">
        <h3 className="llm-eval-response-title">
          Response{response.totalMetrics ? ` (${response.totalMetrics} metrics)` : ''}
        </h3>
        {isMultiMetric && response.results && response.results.length > 1 && (
          <button
            type="button"
            className="llm-eval-report-btn"
            onClick={() => setAllExpanded((prev) => !prev)}
          >
            {allExpanded ? '▾ Collapse All' : '▸ Expand All'}
          </button>
        )}
      </div>
      {(isMultiMetric ? response.totalUsage : response.usage) && (
        <TokenUsageDisplay usage={(isMultiMetric ? response.totalUsage : response.usage)!} />
      )}
      <div className="llm-eval-response-content">
        {isMultiMetric && response.results ? (
          response.results.map((result, idx) => (
            <MetricResultCard
              key={`${result.metric_name}-${idx}-${allExpanded}`}
              result={result}
              defaultExpanded={allExpanded}
            />
          ))
        ) : (
          <>
            <div className="llm-eval-response-grid">
              <div className="llm-eval-response-card llm-eval-response-metric">
                <div className="llm-eval-response-card-label">Metric</div>
                <div className="llm-eval-response-card-value">{metricName.toUpperCase()}</div>
              </div>

              <div className="llm-eval-response-card llm-eval-response-score">
                <div className="llm-eval-response-card-label">Score</div>
                <div className="llm-eval-response-card-score">
                  {score !== null ? score.toFixed(4) : 'N/A'}
                </div>
              </div>

              {response.verdict && (
                <div className="llm-eval-response-card llm-eval-response-verdict-card">
                  <div className="llm-eval-response-card-label">Verdict</div>
                  <div className={`llm-eval-verdict ${getVerdictClass(response.verdict)}`}>
                    {response.verdict}
                  </div>
                </div>
              )}
            </div>

            {response.explanation && (
              <div className="llm-eval-response-section">
                <h4 className="llm-eval-response-section-title">Explanation</h4>
                <p className="llm-eval-response-text">{response.explanation}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
