import React from 'react';

interface MetricSelectorProps {
  metric: string;
  onMetricChange: (metric: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

interface MetricConfig {
  name: string;
  label: string;
  description: string;
  requiredFields: string[];
  optionalFields: string[];
}

const METRICS_CONFIG: Record<string, MetricConfig> = {
  faithfulness: {
    name: 'faithfulness',
    label: '📄 Faithfulness',
    description: 'Measures if the output is consistent with the provided context',
    requiredFields: ['output', 'context'],
    optionalFields: ['query'],
  },
  answer_relevancy: {
    name: 'answer_relevancy',
    label: '🎯 Answer Relevancy',
    description: 'Measures how well the output addresses the query',
    requiredFields: ['query', 'output'],
    optionalFields: ['context'],
  },
  contextual_precision: {
    name: 'contextual_precision',
    label: '🔍 Contextual Precision',
    description: 'Measures if the context is relevant to the expected output',
    requiredFields: ['context', 'expected_output'],
    optionalFields: ['query'],
  },
  contextual_recall: {
    name: 'contextual_recall',
    label: '♻️ Contextual Recall',
    description: 'Measures how much relevant context is retrieved',
    requiredFields: ['context', 'expected_output'],
    optionalFields: ['query'],
  },
  pii_leakage: {
    name: 'pii_leakage',
    label: '🔐 PII Leakage',
    description: 'Detects Personally Identifiable Information in output',
    requiredFields: ['query', 'output'],
    optionalFields: ['context'],
  },
  bias: {
    name: 'bias',
    label: '⚖️ Bias',
    description: 'Detects bias or unfairness in the output',
    requiredFields: ['query', 'output'],
    optionalFields: ['context'],
  },
  hallucination: {
    name: 'hallucination',
    label: '👻 Hallucination',
    description: 'Detects if output contains information not in context',
    requiredFields: ['output', 'context'],
    optionalFields: ['query'],
  },
  toxicity: {
    name: 'toxicity',
    label: '☠️ Toxicity',
    description: 'Detects toxic language (hate speech, insults, threats) in the output',
    requiredFields: ['query', 'output'],
    optionalFields: ['context'],
  },
};

const AVAILABLE_METRICS = Object.keys(METRICS_CONFIG);

export const MetricSelector: React.FC<MetricSelectorProps> = ({
  metric,
  onMetricChange,
  isLoading = false,
  disabled = false,
}) => {
  const selectedConfig = METRICS_CONFIG[metric] || METRICS_CONFIG.faithfulness;

  return (
    <div className="metric-selector">
      <h3>📊 Select Evaluation Metric</h3>
      
      <div className="metric-selector-main">
        <div className="metric-dropdown-group">
          <label htmlFor="metric-select" className="metric-label">
            Evaluation Metric
          </label>
          <select
            id="metric-select"
            value={metric}
            onChange={(e) => onMetricChange(e.target.value)}
            disabled={isLoading || disabled}
            className="metric-select"
          >
            {AVAILABLE_METRICS.map((m) => (
              <option key={m} value={m}>
                {METRICS_CONFIG[m].label}
              </option>
            ))}
          </select>
        </div>

        <div className="metric-info">
          <p className="metric-description">{selectedConfig.description}</p>
          
          <div className="metric-fields">
            <div className="required-fields">
              <h4>✓ Required Fields:</h4>
              <ul>
                {selectedConfig.requiredFields.map((field) => (
                  <li key={field} className="field-required">{field}</li>
                ))}
              </ul>
            </div>

            {selectedConfig.optionalFields.length > 0 && (
              <div className="optional-fields">
                <h4>◇ Optional Fields:</h4>
                <ul>
                  {selectedConfig.optionalFields.map((field) => (
                    <li key={field} className="field-optional">{field}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="metric-hint">
            <p className="hint-text">
              💡 <strong>Note:</strong> Fields marked as "NA" or empty will be skipped.
              The system will only send the required and available fields to the evaluation service.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
