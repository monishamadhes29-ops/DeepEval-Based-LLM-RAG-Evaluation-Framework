import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LLMEvalPage } from './pages/LLMEvalPage';
import { BatchEvalPage } from './pages/BatchEvalPage';
import { MultiTurnEvalPage } from './pages/MultiTurnEvalPage';
import { GoldenDatasetPage } from './pages/GoldenDatasetPage';
import { CustomMetricsPage } from './pages/CustomMetricsPage';
import './styles/app-nav.css';

const BACKEND_URL = 'http://localhost:3001';

type PageType = 'llm-eval' | 'batch-eval' | 'multi-turn-eval' | 'golden-dataset' | 'custom-metrics';

interface FeatureFlags {
  singleTurn: boolean;
  multiTurn: boolean;
  customMetrics: boolean;
  batchEval: boolean;
  goldenDataset: boolean;
}

// Priority order used to pick a fallback tab when the current one gets disabled.
const PAGE_PRIORITY: { page: PageType; flag: keyof FeatureFlags }[] = [
  { page: 'llm-eval', flag: 'singleTurn' },
  { page: 'batch-eval', flag: 'batchEval' },
  { page: 'multi-turn-eval', flag: 'multiTurn' },
  { page: 'golden-dataset', flag: 'goldenDataset' },
  { page: 'custom-metrics', flag: 'customMetrics' },
];

const firstEnabledPage = (features: FeatureFlags): PageType => {
  const match = PAGE_PRIORITY.find(({ flag }) => features[flag]);
  return match ? match.page : 'batch-eval';
};

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('llm-eval');
  // Default all enabled so the UI isn't gated while /api/status hasn't resolved yet,
  // or if the backend is unreachable - the routes themselves still enforce the real toggle.
  const [features, setFeatures] = useState<FeatureFlags>({
    singleTurn: true,
    multiTurn: true,
    customMetrics: true,
    batchEval: true,
    goldenDataset: true,
  });

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/status`)
      .then((res) => {
        const flags = res.data?.features;
        if (!flags) return;

        const nextFeatures: FeatureFlags = {
          singleTurn: flags.singleTurn !== false,
          multiTurn: flags.multiTurn !== false,
          customMetrics: flags.customMetrics !== false,
          batchEval: flags.batchEval !== false,
          goldenDataset: flags.goldenDataset !== false,
        };
        setFeatures(nextFeatures);

        setCurrentPage((prev) => {
          const stillEnabled = PAGE_PRIORITY.find((p) => p.page === prev);
          if (stillEnabled && nextFeatures[stillEnabled.flag]) return prev;
          return firstEnabledPage(nextFeatures);
        });
      })
      .catch(() => {
        // Backend unreachable at mount - keep tabs visible; the endpoints
        // themselves still 403 if actually disabled, this is just tab visibility.
      });
  }, []);

  return (
    <div className="app-container">
      {/* Navigation */}
      <nav className="app-nav">
        <div className="nav-brand">
          <span className="nav-icon">🎯</span>
          <span className="nav-title">Testleaf Evaluation Suite</span>
        </div>

        <div className="nav-menu">
          {features.singleTurn && (
            <button
              className={`nav-link ${currentPage === 'llm-eval' ? 'active' : ''}`}
              onClick={() => setCurrentPage('llm-eval')}
            >
              📊 Single Evaluation
            </button>
          )}
          {features.batchEval && (
            <button
              className={`nav-link ${currentPage === 'batch-eval' ? 'active' : ''}`}
              onClick={() => setCurrentPage('batch-eval')}
            >
              📁 Batch Evaluation
            </button>
          )}
          {features.multiTurn && (
            <button
              className={`nav-link ${currentPage === 'multi-turn-eval' ? 'active' : ''}`}
              onClick={() => setCurrentPage('multi-turn-eval')}
            >
              💬 Multi-Turn Evaluation
            </button>
          )}
          {features.goldenDataset && (
            <button
              className={`nav-link ${currentPage === 'golden-dataset' ? 'active' : ''}`}
              onClick={() => setCurrentPage('golden-dataset')}
            >
              ✨ Golden Dataset
            </button>
          )}
          {features.customMetrics && (
            <button
              className={`nav-link ${currentPage === 'custom-metrics' ? 'active' : ''}`}
              onClick={() => setCurrentPage('custom-metrics')}
            >
              🧩 Custom Metrics (G-Eval)
            </button>
          )}
        </div>
      </nav>

      {/* Page Content */}
      <div className="app-content">
        {currentPage === 'llm-eval' && features.singleTurn && <LLMEvalPage />}
        {currentPage === 'batch-eval' && features.batchEval && <BatchEvalPage />}
        {currentPage === 'multi-turn-eval' && features.multiTurn && <MultiTurnEvalPage />}
        {currentPage === 'golden-dataset' && features.goldenDataset && <GoldenDatasetPage />}
        {currentPage === 'custom-metrics' && features.customMetrics && <CustomMetricsPage />}
      </div>

      <footer className="app-footer">
        &copy; {new Date().getFullYear()} Testleaf. All rights reserved.
      </footer>
    </div>
  );
}

export default App;
