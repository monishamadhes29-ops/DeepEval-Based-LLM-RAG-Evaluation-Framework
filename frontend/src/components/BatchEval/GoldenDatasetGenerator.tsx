import React, { useState } from 'react';
import axios, { AxiosError } from 'axios';
import * as XLSX from 'xlsx';
import { TokenUsage } from '../LLMEval/types';
import { TokenUsageDisplay } from '../LLMEval/ResponsePanel';

const BACKEND_URL = 'http://localhost:3001';

interface GoldenResult {
  query: string;
  expected_output?: string;
  context?: string[];
}

export const GoldenDatasetGenerator: React.FC = () => {
  const [documents, setDocuments] = useState<string[]>(['']);
  const [maxGoldensPerContext, setMaxGoldensPerContext] = useState(2);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goldens, setGoldens] = useState<GoldenResult[] | null>(null);
  const [usage, setUsage] = useState<TokenUsage | null>(null);

  const handleDocChange = (index: number, value: string) => {
    const next = [...documents];
    next[index] = value;
    setDocuments(next);
  };

  const handleAddDoc = () => setDocuments([...documents, '']);
  const handleDeleteDoc = (index: number) => setDocuments(documents.filter((_, i) => i !== index));

  const handleGenerate = async () => {
    setError(null);
    setGoldens(null);
    setUsage(null);

    const validDocs = documents.filter((d) => d.trim().length > 0);
    if (validDocs.length === 0) {
      setError('Add at least one source document/context to generate goldens from.');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/batch/generate-goldens`, {
        contexts: validDocs.map((d) => [d]),
        maxGoldensPerContext,
      });
      setGoldens(response.data.goldens);
      setUsage(response.data.usage || null);
    } catch (err) {
      const axiosError = err as AxiosError<{ error?: string; details?: string }>;
      setError(
        axiosError.response?.data?.details ||
        axiosError.response?.data?.error ||
        axiosError.message ||
        'Failed to generate golden dataset'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!goldens || goldens.length === 0) return;

    // Column names match what /api/batch/upload-excel + /api/batch/evaluate expect,
    // so the downloaded file can be filled in (output, Metrics) and re-uploaded directly.
    const rows = goldens.map((g) => ({
      query: g.query,
      output: '',
      context: (g.context || []).join(' | '),
      expected_output: g.expected_output || '',
      Metrics: '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Goldens');
    XLSX.writeFile(workbook, 'golden-dataset.xlsx');
  };

  return (
    <div className="golden-dataset-generator">
      <div className="golden-dataset-header">
        <h3>✨ Generate Golden Dataset</h3>
        <p className="golden-dataset-subtitle">
          Don't have a test dataset yet? Paste source documents or context below and DeepEval will
          synthesize queries and reference answers you can evaluate against.
        </p>
      </div>

      <div className="llm-eval-form-group">
        <label className="llm-eval-form-label">Source Documents / Context</label>
        <div className="llm-eval-context-list">
          {documents.map((doc, index) => (
            <div key={index} className="llm-eval-context-item golden-dataset-doc-item">
              <textarea
                className="llm-eval-input llm-eval-textarea"
                rows={3}
                placeholder={`Document ${index + 1} - paste a paragraph of source text`}
                value={doc}
                onChange={(e) => handleDocChange(index, e.target.value)}
              />
              <button
                type="button"
                className="llm-eval-context-delete-btn"
                onClick={() => handleDeleteDoc(index)}
                title="Delete document"
                disabled={documents.length <= 1}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="llm-eval-btn llm-eval-btn-primary llm-eval-add-context-btn"
          onClick={handleAddDoc}
        >
          + Add Document
        </button>
      </div>

      <div className="llm-eval-form-group golden-dataset-max-goldens">
        <label className="llm-eval-form-label" htmlFor="max-goldens">
          Goldens per document
        </label>
        <input
          id="max-goldens"
          type="number"
          min={2}
          max={10}
          className="llm-eval-input"
          value={maxGoldensPerContext}
          onChange={(e) => setMaxGoldensPerContext(Math.max(2, parseInt(e.target.value, 10) || 2))}
        />
      </div>

      <button
        className="llm-eval-btn llm-eval-btn-evaluate"
        onClick={handleGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? '⏳ Generating...' : '✨ Generate Goldens'}
      </button>

      {error && (
        <div className="llm-eval-error-alert">
          <div className="llm-eval-error-message-box">{error}</div>
        </div>
      )}

      {goldens && goldens.length > 0 && (
        <div className="golden-dataset-results">
          <div className="golden-dataset-results-header">
            <h4>{goldens.length} Golden(s) Generated</h4>
            <button className="llm-eval-btn llm-eval-btn-primary" onClick={handleDownload}>
              ⬇️ Download as Excel
            </button>
          </div>
          {usage && <TokenUsageDisplay usage={usage} />}
          <div className="golden-dataset-table-wrapper">
            <table className="golden-dataset-table">
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Expected Output</th>
                  <th>Context</th>
                </tr>
              </thead>
              <tbody>
                {goldens.map((g, idx) => (
                  <tr key={idx}>
                    <td>{g.query}</td>
                    <td>{g.expected_output}</td>
                    <td>{(g.context || []).join(' | ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="golden-dataset-hint">
            💡 Download the Excel file, fill in the "output" column with your LLM/RAG's actual response
            for each query, choose a "Metrics" value per row, then upload it below to run a batch evaluation.
          </p>
        </div>
      )}
    </div>
  );
};
