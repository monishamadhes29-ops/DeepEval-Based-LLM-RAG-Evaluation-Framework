import React, { useState } from 'react';
import axios, { AxiosError } from 'axios';
import { ExcelUpload } from '../components/BatchEval/ExcelUpload';
import { DatasetPreview } from '../components/BatchEval/DatasetPreview';
import { JsonConverter } from '../components/BatchEval/JsonConverter';
import { BatchEvaluationResults, EvaluationResult } from '../components/BatchEval/BatchEvaluationResults';
import ReportGenerator from '../components/BatchEval/ReportGenerator';
import { ExcelParseResponse, BatchEvalState, Dataset, SheetData } from '../components/BatchEval/types';
import { TokenUsage } from '../components/LLMEval/types';
import '../styles/batch-eval.css';

const BACKEND_URL = 'http://localhost:3001';

export const BatchEvalPage: React.FC = () => {
  const [state, setState] = useState<BatchEvalState>({
    excelFile: null,
    fileSelected: false,
    parseResult: null,
    isLoading: false,
    error: null,
    selectedSheet: null,
    jsonData: null,
  });

  const [evaluationResults, setEvaluationResults] = useState<EvaluationResult[] | null>(null);
  const [evaluationStats, setEvaluationStats] = useState<{
    totalRecords: number;
    successCount: number;
    errorCount: number;
    metricsUsed: string[];
    totalUsage?: TokenUsage | null;
  } | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const handleFileSelected = async (file: File) => {
    setState((prev: BatchEvalState) => ({
      ...prev,
      excelFile: file,
      fileSelected: true,
      isLoading: true,
      error: null,
    }));

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);

      console.log(`📤 Uploading Excel file: ${file.name}`);

      // Upload and parse Excel file
      const response = await axios.post<ExcelParseResponse>(
        `${BACKEND_URL}/api/batch/upload-excel`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log('✅ Excel file uploaded and parsed:', response.data);

      // Set the first sheet as default selected sheet
      const firstSheetName = response.data.datasets[0]?.sheetName;
      const firstSheetData = response.data.datasets[0]?.data || [];

      setState((prev: BatchEvalState) => ({
        ...prev,
        parseResult: response.data,
        selectedSheet: firstSheetName,
        jsonData: firstSheetData,
        isLoading: false,
      }));
    } catch (error) {
      const axiosError = error as AxiosError<{ error?: string; details?: string }>;
      const errorMessage =
        axiosError.response?.data?.error ||
        axiosError.response?.data?.details ||
        axiosError.message ||
        'Failed to parse Excel file';

      console.error('❌ Error parsing Excel file:', errorMessage);

      setState((prev: BatchEvalState) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  };

  const handleSheetSelect = (sheetName: string) => {
    if (state.parseResult) {
      const selectedSheetData = state.parseResult.datasets.find(
        (sheet: SheetData) => sheet.sheetName === sheetName
      );

      setState((prev: BatchEvalState) => ({
        ...prev,
        selectedSheet: sheetName,
        jsonData: selectedSheetData?.data || null,
      }));

      console.log(`📋 Selected sheet: ${sheetName}`);
    }
  };

  const handleConvertToJSON = () => {
    if (state.jsonData) {
      const jsonString = JSON.stringify(state.jsonData, null, 2);
      
      // Create a blob and download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.selectedSheet || 'data'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('✅ JSON file downloaded');
    }
  };

  const handleRunBatchEvaluation = async () => {
    if (!state.jsonData || state.jsonData.length === 0) {
      setState((prev) => ({
        ...prev,
        error: 'No JSON data to evaluate. Please upload and convert an Excel file first.',
      }));
      return;
    }

    // Check if "Metrics" column exists in the data
    const firstRecord = state.jsonData[0];
    if (!firstRecord.Metrics) {
      setState((prev) => ({
        ...prev,
        error: 'No "Metrics" column found in the Excel data. Each row should have a "Metrics" column with the evaluation metric.',
      }));
      return;
    }

    setIsEvaluating(true);
    setState((prev) => ({ ...prev, error: null }));

    try {
      console.log(`🔄 Running batch evaluation using metrics from Excel data`);
      console.log(`📊 Processing ${state.jsonData.length} records...`);

      const response = await axios.post(
        `${BACKEND_URL}/api/batch/evaluate`,
        {
          jsonData: state.jsonData,
          metricColumn: 'Metrics', // Explicitly specify the column name
        }
      );

      console.log('✅ Batch evaluation completed:', response.data);

      setEvaluationResults(response.data.results);
      setEvaluationStats({
        totalRecords: response.data.totalRecords,
        successCount: response.data.successCount,
        errorCount: response.data.errorCount,
        metricsUsed: response.data.metricsUsed || [],
        totalUsage: response.data.totalUsage || null,
      });

      // Smooth scroll to results
      setTimeout(() => {
        const resultsElement = document.querySelector('.batch-evaluation-results');
        if (resultsElement) {
          resultsElement.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (error) {
      const axiosError = error as AxiosError<{ error?: string; details?: string }>;
      const errorMessage =
        axiosError.response?.data?.error ||
        axiosError.response?.data?.details ||
        axiosError.message ||
        'Failed to run batch evaluation';

      console.error('❌ Error running batch evaluation:', errorMessage);

      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }));
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="batch-eval-page">
      {/* Header */}
      <div className="batch-eval-header">
        <div className="header-content">
          <h1>🚀 Batch Evaluation from Excel</h1>
          <p className="header-subtitle">Upload and evaluate multiple datasets at once</p>
        </div>
      </div>

      {/* Container */}
      <div className="batch-eval-container">
        {/* Error Alert */}
        {state.error && (
          <div className="error-alert">
            <span className="error-icon">❌</span>
            <div className="error-content">
              <strong>Error:</strong> {state.error}
            </div>
          </div>
        )}

        {/* Upload Section */}
        {!state.parseResult && (
          <ExcelUpload
            onFileSelected={handleFileSelected}
            isLoading={state.isLoading}
            fileName={state.excelFile?.name || null}
          />
        )}

        {/* Results Section */}
        {state.parseResult && (
          <div className="results-section">
            {/* Summary Card */}
            <div className="summary-card">
              <div className="summary-stat">
                <span className="stat-icon">📊</span>
                <div className="stat-content">
                  <span className="stat-label">Total Datasets</span>
                  <span className="stat-value">{state.parseResult.totalDatasets}</span>
                </div>
              </div>

              <div className="summary-stat">
                <span className="stat-icon">📄</span>
                <div className="stat-content">
                  <span className="stat-label">Sheets</span>
                  <span className="stat-value">{state.parseResult.sheetNames.length}</span>
                </div>
              </div>

              <div className="summary-stat">
                <span className="stat-icon">📁</span>
                <div className="stat-content">
                  <span className="stat-label">File</span>
                  <span className="stat-value">{state.parseResult.fileName}</span>
                </div>
              </div>

              <button
                className="btn-upload-new"
                onClick={() => {
                  setState({
                    excelFile: null,
                    fileSelected: false,
                    parseResult: null,
                    isLoading: false,
                    error: null,
                    selectedSheet: null,
                    jsonData: null,
                  });
                }}
              >
                📤 Upload New File
              </button>
            </div>

            {/* Dataset Preview */}
            {state.parseResult.datasets.length > 0 && (
              <DatasetPreview
                sheetsData={state.parseResult.datasets}
                selectedSheet={state.selectedSheet}
                onSheetSelect={handleSheetSelect}
              />
            )}

            {/* JSON Display */}
            <JsonConverter
              data={state.jsonData}
              sheetName={state.selectedSheet}
              onDownload={handleConvertToJSON}
            />

            {/* Metric Info and Evaluation Section */}
            {state.jsonData && state.jsonData.length > 0 && (
              <div className="evaluation-section">
                <div className="metric-info-banner">
                  <div className="metric-info-content">
                    <span className="metric-info-icon">📊</span>
                    <div className="metric-info-text">
                      <h4>Evaluation Metrics from Excel</h4>
                      <p>
                        The "Metrics" column in your Excel file will be used for each row's evaluation.
                        Each row can have a different metric (faithfulness, answer_relevancy, etc.).
                        Rows with NA or missing metric values will use <strong>answer_relevancy</strong> as default.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="evaluation-action">
                  <button
                    className="btn-run-evaluation"
                    onClick={handleRunBatchEvaluation}
                    disabled={isEvaluating || !state.jsonData || state.jsonData.length === 0}
                  >
                    {isEvaluating ? (
                      <>
                        <span className="spinner-inline"></span>
                        Running Evaluation...
                      </>
                    ) : (
                      <>
                        ⚡ Run Batch Evaluation
                      </>
                    )}
                  </button>
                  <p className="evaluation-hint">
                    💡 Click to evaluate all {state.jsonData.length} records using metrics from the "Metrics" column
                  </p>
                </div>
              </div>
            )}

            {/* Evaluation Results */}
            {evaluationResults && evaluationStats && (
              <BatchEvaluationResults
                results={evaluationResults}
                metricsUsed={evaluationStats.metricsUsed}
                totalRecords={evaluationStats.totalRecords}
                successCount={evaluationStats.successCount}
                errorCount={evaluationStats.errorCount}
                isLoading={isEvaluating}
                totalUsage={evaluationStats.totalUsage}
              />
            )}

            {/* Report Generation */}
            {evaluationResults && evaluationStats && (
              <ReportGenerator
                originalData={state.jsonData || []}
                evaluationResults={evaluationResults}
                metricsUsed={evaluationStats.metricsUsed}
              />
            )}

            {/* Next Steps */}
            <div className="next-steps-card">
              <h3>📋 Progress</h3>
              <p className="step completed">
                <strong>✅ Step 1:</strong> Upload and preview Excel file
              </p>
              <p className="step completed">
                <strong>✅ Step 2:</strong> Convert to JSON with formatting options
              </p>
              <p className={`step ${evaluationResults ? 'completed' : 'active'}`}>
                <strong>{evaluationResults ? '✅' : '⏳'} Step 3:</strong> Run batch evaluation on the datasets
              </p>
              <p className={`step ${evaluationResults ? 'active' : ''}`}>
                <strong>{evaluationResults ? '🚀' : '4'}</strong> Generate HTML and Excel reports with scores
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
