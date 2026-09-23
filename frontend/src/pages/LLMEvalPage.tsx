import React from 'react';
import { LLMEvalForm } from '../components/LLMEval/LLMEvalForm';
import '../styles/testleaf-theme.css';

export const LLMEvalPage: React.FC = () => {
  return (
    <div className="llm-eval-page">
      {/* Header */}
      <div className="llm-eval-header">
        <div className="llm-eval-header-content">
          <div className="llm-eval-header-text">
            <h1>Testleaf LLM Evaluation Framework</h1>
            <p className="llm-eval-subtitle"> RAG & LLM Evaluation Platform</p>
          </div>
        </div>
      </div>

      {/* Container */}
      <div className="llm-eval-container">
        <LLMEvalForm />
      </div>
    </div>
  );
};
