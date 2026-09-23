import React from 'react';
import { CustomMetricsForm } from '../components/CustomMetrics/CustomMetricsForm';
import '../styles/testleaf-theme.css';

export const CustomMetricsPage: React.FC = () => {
  return (
    <div className="llm-eval-page">
      <div className="llm-eval-header">
        <div className="llm-eval-header-content">
          <div className="llm-eval-header-text">
            <h1>Custom Metrics (G-Eval)</h1>
            <p className="llm-eval-subtitle">User-defined LLM-as-judge criteria via DeepEval's GEval</p>
          </div>
        </div>
      </div>

      <div className="llm-eval-container">
        <CustomMetricsForm />
      </div>
    </div>
  );
};
