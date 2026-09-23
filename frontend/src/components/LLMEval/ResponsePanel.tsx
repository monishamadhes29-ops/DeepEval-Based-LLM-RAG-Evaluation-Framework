import React, { useState } from 'react';
import axios from 'axios';
import { LLMEvalResponse, MetricResultEntry, FaithfulnessDetail, TokenUsage } from './types';

const BACKEND_URL = 'http://localhost:3001';

interface ResponsePanelProps {
  response: LLMEvalResponse | null;
  isLoading: boolean;
}

/** Token count + estimated cost strip, shown per metric and as a request-level total. */
export const TokenUsageDisplay: React.FC<{ usage: TokenUsage; compact?: boolean }> = ({ usage, compact }) => (
  <div className={`llm-eval-usage-bar ${compact ? 'llm-eval-usage-bar-compact' : ''}`}>
    <span className="llm-eval-usage-item" title="Total tokens">
      🔤 {usage.total_tokens.toLocaleString()} tokens
    </span>
    <span className="llm-eval-usage-item" title="Prompt tokens">
      ↑ {usage.prompt_tokens.toLocaleString()} in
    </span>
    <span className="llm-eval-usage-item" title="Completion tokens">
      ↓ {usage.completion_tokens.toLocaleString()} out
    </span>
    <span className="llm-eval-usage-item llm-eval-usage-cost" title="Estimated cost (approximate)">
      ${usage.estimated_cost_usd.toFixed(4)}
    </span>
  </div>
);

export const getVerdictClass = (verdict: string | null | undefined): string => {
  if (!verdict) return 'llm-eval-verdict-neutral';
  const lowerVerdict = verdict.toLowerCase();

  // RED for negative verdicts (NOT_FAITHFUL, LOW, NOT_RELEVANT, LOW_RECALL, LOW_PRECISION).
  // Checked before the positive block below because e.g. "not_faithful" and "not_relevant"
  // are substrings of "faithful"/"relevant" and would otherwise match the positive check first.
  if (
    lowerVerdict.includes('not_') ||
    lowerVerdict.includes('low') ||
    lowerVerdict === 'poor' ||
    lowerVerdict === 'no' ||
    lowerVerdict === 'false'
  ) {
    return 'llm-eval-verdict-unfaithful';
  }

  // GREEN for positive verdicts (FAITHFUL, HIGH, RELEVANT, HIGH_RECALL, HIGH_PRECISION)
  if (
    lowerVerdict.includes('faithful') ||
    lowerVerdict.includes('high') ||
    lowerVerdict.includes('relevant') ||
    lowerVerdict === 'yes' ||
    lowerVerdict === 'excellent' ||
    lowerVerdict === 'good'
  ) {
    return 'llm-eval-verdict-faithful';
  }

  // AMBER for PARTIAL or ACCEPTABLE verdicts
  if (
    lowerVerdict.includes('partial') ||
    lowerVerdict.includes('acceptable') ||
    lowerVerdict.includes('medium')
  ) {
    return 'llm-eval-verdict-partial';
  }

  return 'llm-eval-verdict-neutral';
};

const claimVerdictClass = (verdict: string): string => {
  const v = verdict.toLowerCase();
  if (v === 'yes') return 'llm-eval-verdict-faithful';
  if (v === 'no') return 'llm-eval-verdict-unfaithful';
  return 'llm-eval-verdict-partial'; // idk
};

/** Claim-by-claim faithfulness breakdown: which claims from the output were found
 * supported/contradicted/ambiguous against the extracted context truths. */
export const FaithfulnessBreakdown: React.FC<{ detail: FaithfulnessDetail }> = ({ detail }) => {
  const [expanded, setExpanded] = useState(true);

  if (!detail.verdicts || detail.verdicts.length === 0) return null;

  return (
    <div className="llm-eval-response-section">
      <button
        type="button"
        className="llm-eval-faithfulness-toggle"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <h4 className="llm-eval-response-section-title">
          {expanded ? '▾' : '▸'} Claim-Level Breakdown ({detail.verdicts.length} claim{detail.verdicts.length === 1 ? '' : 's'})
        </h4>
        <div className="llm-eval-faithfulness-summary">
          <span className="llm-eval-verdict llm-eval-verdict-faithful">✓ {detail.yes_count} supported</span>
          <span className="llm-eval-verdict llm-eval-verdict-unfaithful">✗ {detail.no_count} contradicted</span>
          <span className="llm-eval-verdict llm-eval-verdict-partial">? {detail.idk_count} ambiguous</span>
        </div>
      </button>

      {expanded && (
        <div className="llm-eval-faithfulness-table-wrap">
          <table className="llm-eval-faithfulness-table">
            <thead>
              <tr>
                <th>Claim</th>
                <th>Verdict</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {detail.verdicts.map((v, idx) => (
                <tr key={idx}>
                  <td>{v.claim}</td>
                  <td>
                    <span className={`llm-eval-verdict ${claimVerdictClass(v.verdict)}`}>
                      {v.verdict.toUpperCase()}
                    </span>
                  </td>
                  <td>{v.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/** One metric's score/verdict/explanation card, reused for both the single-metric and multi-metric layouts (also reused by MultiTurnEval). Collapsible so a long multi-metric result list can be scanned via the summary bar alone. */
export const MetricResultCard: React.FC<{ result: MetricResultEntry; defaultExpanded?: boolean }> = ({
  result,
  defaultExpanded = true,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const metricName = String(result.metric_name || 'Unknown Metric').replace(/_/g, ' ');
  const score = result.score ?? null;

  return (
    <div className="llm-eval-response-metric-block">
      <button
        type="button"
        className="llm-eval-metric-card-toggle"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className="llm-eval-metric-card-toggle-icon">{expanded ? '▾' : '▸'}</span>
        <span className="llm-eval-metric-card-toggle-name">{metricName.toUpperCase()}</span>
        <span className="llm-eval-metric-card-toggle-summary">
          {result.error ? (
            <span className="llm-eval-verdict llm-eval-verdict-unfaithful">Error</span>
          ) : (
            <>
              <span className="llm-eval-metric-card-toggle-score">
                {score !== null ? (typeof score === 'number' ? score.toFixed(4) : score) : 'N/A'}
              </span>
              {result.verdict && (
                <span className={`llm-eval-verdict ${getVerdictClass(result.verdict)}`}>{result.verdict}</span>
              )}
            </>
          )}
        </span>
      </button>

      {expanded && (
        <div className="llm-eval-metric-card-body">
          <div className="llm-eval-response-grid">
            <div className="llm-eval-response-card llm-eval-response-metric">
              <div className="llm-eval-response-card-label">Metric</div>
              <div className="llm-eval-response-card-value">{metricName.toUpperCase()}</div>
            </div>

            {result.error ? (
              <div className="llm-eval-response-card llm-eval-response-verdict-card">
                <div className="llm-eval-response-card-label">Error</div>
                <div className="llm-eval-verdict llm-eval-verdict-unfaithful">{result.error}</div>
              </div>
            ) : (
              <>
                <div className="llm-eval-response-card llm-eval-response-score">
                  <div className="llm-eval-response-card-label">Score</div>
                  <div className="llm-eval-response-card-score">
                    {score !== null ? (typeof score === 'number' ? score.toFixed(4) : score) : 'N/A'}
                  </div>
                </div>

                {result.verdict && (
                  <div className="llm-eval-response-card llm-eval-response-verdict-card">
                    <div className="llm-eval-response-card-label">Verdict</div>
                    <div className={`llm-eval-verdict ${getVerdictClass(result.verdict)}`}>
                      {result.verdict}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {result.explanation && (
            <div className="llm-eval-response-section">
              <h4 className="llm-eval-response-section-title">Explanation</h4>
              <p className="llm-eval-response-text">{result.explanation}</p>
            </div>
          )}

          {result.detail && <FaithfulnessBreakdown detail={result.detail} />}

          {result.usage && <TokenUsageDisplay usage={result.usage} compact />}
        </div>
      )}
    </div>
  );
};

const downloadHTML = (htmlContent: string, filename: string) => {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

const downloadExcel = (buffer: ArrayBuffer, filename: string) => {
  const blob = new Blob([new Uint8Array(buffer)], { type: 'application/octet-stream' });
  const element = document.createElement('a');
  element.setAttribute('href', URL.createObjectURL(blob));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

/** "Download Report" buttons for the current evaluation result, reusing the same
 * report machinery as batch eval's ReportGenerator but scoped to one evaluation. */
const ReportDownloadButtons: React.FC<{ response: LLMEvalResponse }> = ({ response }) => {
  const [downloadingType, setDownloadingType] = useState<'html' | 'excel' | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async (type: 'html' | 'excel') => {
    setDownloadingType(type);
    setDownloadError(null);

    const payload: any = {
      query: response.query,
      output: response.output,
      context: response.context,
      reportType: type,
    };
    if (Array.isArray(response.results) && response.results.length > 0) {
      payload.results = response.results;
    } else {
      payload.metric_name = response.metric_name || response.metric;
      payload.score = response.score;
      payload.verdict = response.verdict;
      payload.explanation = response.explanation;
    }

    try {
      const res = await axios.post(`${BACKEND_URL}/api/eval-report`, payload, {
        responseType: type === 'excel' ? 'arraybuffer' : 'text',
      });

      if (type === 'html') {
        downloadHTML(res.data, 'evaluation-report.html');
      } else {
        downloadExcel(res.data, 'evaluation-report.xlsx');
      }
    } catch (err) {
      console.error('❌ Error generating report:', err);
      setDownloadError('Failed to generate report');
    } finally {
      setDownloadingType(null);
    }
  };

  return (
    <div className="llm-eval-report-actions">
      <button
        type="button"
        className="llm-eval-report-btn"
        onClick={() => handleDownload('html')}
        disabled={downloadingType !== null}
      >
        {downloadingType === 'html' ? '⏳' : '📄'} HTML Report
      </button>
      <button
        type="button"
        className="llm-eval-report-btn"
        onClick={() => handleDownload('excel')}
        disabled={downloadingType !== null}
      >
        {downloadingType === 'excel' ? '⏳' : '📑'} Excel Report
      </button>
      {downloadError && <span className="llm-eval-report-error">{downloadError}</span>}
    </div>
  );
};

export const ResponsePanel: React.FC<ResponsePanelProps> = ({ response, isLoading }) => {
  const [allExpanded, setAllExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className="llm-eval-response-panel">
        <h3 className="llm-eval-response-title">Response</h3>
        <div className="llm-eval-loading-container">
          <div className="llm-eval-loader"></div>
          <span className="llm-eval-loading-text">Evaluating your metrics...</span>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="llm-eval-response-panel">
        <h3 className="llm-eval-response-title">Response</h3>
        <div className="llm-eval-placeholder-text">
          Click "Evaluate" to see results
        </div>
      </div>
    );
  }

  try {
    // Debug: Log the full response
    console.log("📥 ResponsePanel received:", JSON.stringify(response, null, 2));

    const query = response.query || null;
    const output = response.output || null;
    const context = Array.isArray(response.context) ? response.context.filter((c) => c && c.trim()) : [];

    // Multi-metric path: multi-select ( > 1 metric) or metric: "all" both return response.results[]
    const isMultiMetric =
      Array.isArray(response.results) &&
      response.results.length > 0 &&
      (response.allMetrics || response.results.length > 1);

    if (isMultiMetric && response.results) {
      return (
        <div className="llm-eval-response-panel">
          <div className="llm-eval-response-header-row">
            <h3 className="llm-eval-response-title">
              Response{response.totalMetrics ? ` (${response.totalMetrics} metrics)` : ''}
            </h3>
            <div className="llm-eval-response-header-actions">
              <button
                type="button"
                className="llm-eval-report-btn"
                onClick={() => setAllExpanded((prev) => !prev)}
              >
                {allExpanded ? '▾ Collapse All' : '▸ Expand All'}
              </button>
              <ReportDownloadButtons response={response} />
            </div>
          </div>
          {response.totalUsage && <TokenUsageDisplay usage={response.totalUsage} />}
          <div className="llm-eval-response-content">
            {(query || output || context.length > 0) && (
              <div className="llm-eval-response-section">
                <h4 className="llm-eval-response-section-title">Evaluation Input</h4>
                {query && (
                  <div className="llm-eval-response-subsection">
                    <strong className="llm-eval-response-sublabel">Query:</strong>
                    <p className="llm-eval-response-text">{query}</p>
                  </div>
                )}
                {output && (
                  <div className="llm-eval-response-subsection">
                    <strong className="llm-eval-response-sublabel">Output:</strong>
                    <p className="llm-eval-response-text">{output}</p>
                  </div>
                )}
                {context.length > 0 && (
                  <div className="llm-eval-response-subsection">
                    <strong className="llm-eval-response-sublabel">Retrieved Context:</strong>
                    {context.map((ctx, idx) => (
                      <p key={idx} className="llm-eval-response-text">{ctx}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {response.results.map((result, idx) => (
              <MetricResultCard
                key={`${result.metric_name}-${idx}-${allExpanded}`}
                result={result}
                defaultExpanded={allExpanded}
              />
            ))}
          </div>
        </div>
      );
    }

    // Single-metric path (legacy top-level fields)
    const score = response.score ?? null;
    const metricName = String(response.metric_name || response.metric || 'Unknown Metric')
      .replace(/_/g, ' ');
    const explanation = response.explanation || null;
    const verdict = response.verdict || null;
    const reference_used = response.reference_used || null;

    return (
      <div className="llm-eval-response-panel">
        <div className="llm-eval-response-header-row">
          <h3 className="llm-eval-response-title">Response</h3>
          <ReportDownloadButtons response={response} />
        </div>
        {response.usage && <TokenUsageDisplay usage={response.usage} />}
        <div className="llm-eval-response-content">
          {/* Metric & Score Row */}
          <div className="llm-eval-response-grid">
            <div className="llm-eval-response-card llm-eval-response-metric">
              <div className="llm-eval-response-card-label">Metric</div>
              <div className="llm-eval-response-card-value">
                {metricName.toUpperCase()}
              </div>
            </div>

            <div className="llm-eval-response-card llm-eval-response-score">
              <div className="llm-eval-response-card-label">Score</div>
              <div className="llm-eval-response-card-score">
                {score !== null ? (typeof score === 'number' ? score.toFixed(4) : score) : 'N/A'}
              </div>
            </div>

            {verdict && (
              <div className="llm-eval-response-card llm-eval-response-verdict-card">
                <div className="llm-eval-response-card-label">Verdict</div>
                <div className={`llm-eval-verdict ${getVerdictClass(verdict)}`}>
                  {verdict}
                </div>
              </div>
            )}
          </div>

          {/* Explanation Section */}
          {explanation && (
            <div className="llm-eval-response-section">
              <h4 className="llm-eval-response-section-title">Explanation</h4>
              <p className="llm-eval-response-text">{explanation}</p>
            </div>
          )}

          {/* Claim-Level Breakdown (faithfulness only) */}
          {response.detail && <FaithfulnessBreakdown detail={response.detail} />}

          {/* Reference Section */}
          {reference_used && (
            <div className="llm-eval-response-section">
              <h4 className="llm-eval-response-section-title">Reference Used</h4>
              <div className="llm-eval-response-reference">
                <p className="llm-eval-response-text">{reference_used}</p>
              </div>
            </div>
          )}

          {/* Query & Output Section */}
          {(query || output || context.length > 0) && (
            <div className="llm-eval-response-section">
              <h4 className="llm-eval-response-section-title">Evaluation Input</h4>
              {query && (
                <div className="llm-eval-response-subsection">
                  <strong className="llm-eval-response-sublabel">Query:</strong>
                  <p className="llm-eval-response-text">{query}</p>
                </div>
              )}
              {output && !metricName.toLowerCase().includes('contextual') && (
                <div className="llm-eval-response-subsection">
                  <strong className="llm-eval-response-sublabel">Output:</strong>
                  <p className="llm-eval-response-text">{output}</p>
                </div>
              )}
              {context.length > 0 && (
                <div className="llm-eval-response-subsection">
                  <strong className="llm-eval-response-sublabel">Retrieved Context:</strong>
                  {context.map((ctx, idx) => (
                    <p key={idx} className="llm-eval-response-text">{ctx}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error('ResponsePanel render error:', error);
    return (
      <div className="llm-eval-response-panel">
        <h3 className="llm-eval-response-title">Response</h3>
        <div className="llm-eval-error-alert">
          <p>⚠️ Error displaying response data</p>
        </div>
      </div>
    );
  }
};
