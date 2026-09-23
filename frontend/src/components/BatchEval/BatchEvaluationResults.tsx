import React, { useState } from 'react';
import { TokenUsage } from '../LLMEval/types';
import { TokenUsageDisplay } from '../LLMEval/ResponsePanel';

export interface EvaluationResult {
  rowIndex: number;
  originalData: any;
  metric_name: string;
  score?: number;
  verdict?: string;
  explanation?: string;
  error?: string;
  usage?: TokenUsage | null;
  // For "all" metrics
  allMetrics?: boolean;
  totalMetrics?: number;
  metricsResults?: Array<{
    metric_name: string;
    score?: number;
    verdict?: string;
    explanation?: string;
    usage?: TokenUsage | null;
  }>;
}

interface BatchEvaluationResultsProps {
  results: EvaluationResult[];
  metricsUsed: string[];
  totalRecords: number;
  successCount: number;
  errorCount: number;
  isLoading?: boolean;
  totalUsage?: TokenUsage | null;
}

export const BatchEvaluationResults: React.FC<BatchEvaluationResultsProps> = ({
  results,
  metricsUsed,
  totalRecords,
  successCount,
  errorCount,
  isLoading = false,
  totalUsage,
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');

  const toggleRowExpand = (rowIndex: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowIndex)) {
      newExpanded.delete(rowIndex);
    } else {
      newExpanded.add(rowIndex);
    }
    setExpandedRows(newExpanded);
  };

  const filteredResults = results.filter((result) => {
    if (filter === 'success') return !result.error;
    if (filter === 'error') return result.error;
    return true;
  });

  const getVerdictBadge = (verdict?: string) => {
    if (!verdict) return null;
    const badgeClass = verdict.toLowerCase() === 'yes' ? 'badge-pass' : 'badge-fail';
    return <span className={`verdict-badge ${badgeClass}`}>{verdict}</span>;
  };

  const getScoreColor = (score?: number) => {
    if (score === undefined) return '';
    if (score >= 0.8) return 'score-excellent';
    if (score >= 0.6) return 'score-good';
    if (score >= 0.4) return 'score-fair';
    return 'score-poor';
  };

  return (
    <div className="batch-evaluation-results">
      <div className="results-header">
        <h3>📋 Evaluation Results</h3>
        <div className="metrics-used-display">
          <p className="metrics-label">Metrics Used:</p>
          <div className="metrics-badges">
            {metricsUsed.map((m) => (
              <span key={m} className="metric-badge">{m}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="results-stats">
        <div className="stat-card stat-total">
          <div className="stat-value">{totalRecords}</div>
          <div className="stat-label">Total Records</div>
        </div>
        <div className="stat-card stat-success">
          <div className="stat-value">{successCount}</div>
          <div className="stat-label">Success</div>
          <div className="stat-percent">
            {((successCount / totalRecords) * 100).toFixed(1)}%
          </div>
        </div>
        <div className="stat-card stat-error">
          <div className="stat-value">{errorCount}</div>
          <div className="stat-label">Errors</div>
          {errorCount > 0 && (
            <div className="stat-percent">
              {((errorCount / totalRecords) * 100).toFixed(1)}%
            </div>
          )}
        </div>
        {totalUsage && (
          <div className="stat-card stat-usage">
            <div className="stat-value">{totalUsage.total_tokens.toLocaleString()}</div>
            <div className="stat-label">Total Tokens</div>
          </div>
        )}
        {totalUsage && (
          <div className="stat-card stat-cost">
            <div className="stat-value">${totalUsage.estimated_cost_usd.toFixed(4)}</div>
            <div className="stat-label">Est. Cost</div>
          </div>
        )}
      </div>

      <div className="results-filter">
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
            disabled={isLoading}
          >
            All ({results.length})
          </button>
          <button
            className={`filter-btn ${filter === 'success' ? 'active' : ''}`}
            onClick={() => setFilter('success')}
            disabled={isLoading}
          >
            ✓ Success ({successCount})
          </button>
          <button
            className={`filter-btn ${filter === 'error' ? 'active' : ''}`}
            onClick={() => setFilter('error')}
            disabled={isLoading}
          >
            ✗ Errors ({errorCount})
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Processing batch evaluation...</p>
        </div>
      )}

      {!isLoading && filteredResults.length === 0 && (
        <div className="no-results">
          <p>No results to display</p>
        </div>
      )}

      {!isLoading && filteredResults.length > 0 && (
        <div className="results-table-container">
          <table className="results-table">
            <thead>
              <tr>
                <th className="col-row">#</th>
                <th className="col-status">Status</th>
                <th className="col-metric">Metric</th>
                <th className="col-score">Score</th>
                <th className="col-verdict">Verdict</th>
                <th className="col-explanation">Explanation</th>
                <th className="col-actions">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((result) => (
                <React.Fragment key={result.rowIndex}>
                  <tr className={`result-row ${result.error ? 'error' : 'success'}`}>
                    <td className="col-row">{result.rowIndex}</td>
                    <td className="col-status">
                      {result.error ? (
                        <span className="status-badge error">Error</span>
                      ) : (
                        <span className="status-badge success">✓</span>
                      )}
                    </td>
                    <td className="col-metric">
                      <span className="metric-name" title={result.metric_name}>
                        {result.metric_name.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="col-score">
                      {result.error ? (
                        <span className="empty-value">—</span>
                      ) : result.allMetrics && result.metricsResults ? (
                        <div className="score-all-metrics">
                          {result.metricsResults.map((m, idx) => (
                            <div key={idx} className={`score-item ${getScoreColor(m.score)}`}>
                              <small>{m.metric_name}:</small>
                              <span className="score-value">{m.score?.toFixed(3) || '—'}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className={`score-value ${getScoreColor(result.score)}`}>
                          {result.score?.toFixed(3) || '—'}
                        </span>
                      )}
                    </td>
                    <td className="col-verdict">
                      {result.error ? (
                        <span className="empty-value">—</span>
                      ) : result.allMetrics && result.metricsResults ? (
                        <div className="verdict-all-metrics">
                          {result.metricsResults.map((m, idx) => (
                            <div key={idx} className="verdict-item">
                              <small>{m.metric_name}:</small>
                              {getVerdictBadge(m.verdict) || <span className="empty-value">—</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        getVerdictBadge(result.verdict) || <span className="empty-value">—</span>
                      )}
                    </td>
                    <td className="col-explanation">
                      <span className="explanation-text">
                        {result.error ? (
                          <span className="error-message">{result.error}</span>
                        ) : result.explanation ? (
                          result.explanation.substring(0, 50) + (result.explanation.length > 50 ? '...' : '')
                        ) : (
                          <span className="empty-value">—</span>
                        )}
                      </span>
                    </td>
                    <td className="col-actions">
                      <button
                        className="expand-btn"
                        onClick={() => toggleRowExpand(result.rowIndex)}
                        title="Show details"
                      >
                        {expandedRows.has(result.rowIndex) ? '▼' : '▶'}
                      </button>
                    </td>
                  </tr>

                  {expandedRows.has(result.rowIndex) && (
                    <tr className="expanded-row">
                      <td colSpan={6}>
                        <div className="row-details">
                          {!result.error && (
                            <>
                              {result.allMetrics && result.metricsResults && (
                                <div className="detail-section">
                                  <h5>All Metrics Results ({result.totalMetrics})</h5>
                                  <div className="metrics-table">
                                    {result.metricsResults.map((m, idx) => (
                                      <div key={idx} className="metric-row">
                                        <div className="metric-col-name">{m.metric_name}</div>
                                        <div className={`metric-col-score ${getScoreColor(m.score)}`}>
                                          {m.score?.toFixed(3) || '—'}
                                        </div>
                                        <div className="metric-col-verdict">
                                          {getVerdictBadge(m.verdict) || <span className="empty-value">—</span>}
                                        </div>
                                        {m.explanation && (
                                          <div className="metric-col-explanation">{m.explanation.substring(0, 100)}...</div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {result.explanation && !result.allMetrics && (
                                <div className="detail-section">
                                  <h5>Explanation</h5>
                                  <p>{result.explanation}</p>
                                </div>
                              )}
                              {result.usage && (
                                <div className="detail-section">
                                  <h5>Token Usage</h5>
                                  <TokenUsageDisplay usage={result.usage} compact />
                                </div>
                              )}
                              <div className="detail-section">
                                <h5>Original Data</h5>
                                <pre className="original-data">
                                  {JSON.stringify(result.originalData, null, 2)}
                                </pre>
                              </div>
                            </>
                          )}
                          {result.error && (
                            <div className="detail-section error-details">
                              <h5>Error Details</h5>
                              <p className="error-message">{result.error}</p>
                              <div className="original-data-error">
                                <h6>Original Data</h6>
                                <pre>{JSON.stringify(result.originalData, null, 2)}</pre>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
