import React from 'react';
import { MultiTurnForm } from '../components/MultiTurnEval/MultiTurnForm';
import '../styles/testleaf-theme.css';

export const MultiTurnEvalPage: React.FC = () => {
  return (
    <div className="llm-eval-page">
      {/* Header */}
      <div className="llm-eval-header">
        <div className="llm-eval-header-content">
          <div className="llm-eval-header-text">
            <h1>Multi-Turn Conversation Evaluation</h1>
            <p className="llm-eval-subtitle">Conversation Completeness (DeepEval)</p>
          </div>
        </div>
      </div>

      {/* Container */}
      <div className="llm-eval-container">
        <MultiTurnForm />
      </div>
    </div>
  );
};
