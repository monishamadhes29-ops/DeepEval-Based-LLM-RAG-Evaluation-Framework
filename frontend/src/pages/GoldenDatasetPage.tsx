import React from 'react';
import { GoldenDatasetGenerator } from '../components/BatchEval/GoldenDatasetGenerator';
import '../styles/testleaf-theme.css';
import '../styles/batch-eval.css';

export const GoldenDatasetPage: React.FC = () => {
  return (
    <div className="llm-eval-page">
      {/* Header */}
      <div className="llm-eval-header">
        <div className="llm-eval-header-content">
          <div className="llm-eval-header-text">
            <h1>Golden Dataset Generator</h1>
            <p className="llm-eval-subtitle">
              Synthesize test queries and reference answers from source context (DeepEval)
            </p>
          </div>
        </div>
      </div>

      {/* Container */}
      <div className="llm-eval-container">
        <GoldenDatasetGenerator />
      </div>
    </div>
  );
};
