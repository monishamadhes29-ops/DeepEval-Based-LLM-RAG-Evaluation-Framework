import React, { useState } from 'react';
import axios from 'axios';

interface ReportGeneratorProps {
  originalData: any[];
  evaluationResults: any[];
  metricsUsed: string[];
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({
  originalData,
  evaluationResults,
  metricsUsed,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReports = async (type: 'html' | 'excel' | 'both') => {
    setLoading(true);
    setError(null);

    try {
      console.log(`📄 Requesting ${type} report generation...`);
      
      // DEBUG: Log what we're sending
      const resultsWithMetrics = evaluationResults.filter((r: any) => r.metricsResults);
      const resultsWithAllMetrics = evaluationResults.filter((r: any) => r.allMetrics);
      console.log(`   Frontend sending to backend:`, {
        totalResults: evaluationResults.length,
        resultsWithMetrics: resultsWithMetrics.length,
        resultsWithAllMetrics: resultsWithAllMetrics.length,
        sample: evaluationResults[0]
      });

      if (type === 'both') {
        // For "both", download HTML and Excel separately to avoid encoding issues
        await handleGenerateReports('html');
        // Small delay before second download
        setTimeout(() => {
          handleGenerateReports('excel');
        }, 500);
        setLoading(false);
        return;
      }

      const response = await axios.post(
        'http://localhost:3001/api/batch/generate-report',
        {
          originalData,
          evaluationResults,
          metricsUsed,
          reportType: type,
        },
        {
          responseType: type === 'excel' ? 'arraybuffer' : 'text',
        }
      );

      if (type === 'html') {
        // For HTML, response is text
        const htmlContent = response.data;
        downloadHTML(htmlContent, 'evaluation-report.html');
      } else if (type === 'excel') {
        // For Excel, response is arraybuffer
        downloadExcel(response.data, 'evaluation-report.xlsx');
      }
    } catch (err) {
      console.error('❌ Error generating report:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const downloadHTML = (htmlContent: string, filename: string) => {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    console.log('✅ HTML report downloaded');
  };

  const downloadExcel = (buffer: ArrayBuffer | string, filename: string) => {
    let bytes: Uint8Array;

    if (buffer instanceof ArrayBuffer) {
      // Direct ArrayBuffer from API response
      bytes = new Uint8Array(buffer);
    } else {
      // Base64 string (fallback)
      const binaryString = atob(buffer);
      bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
    }

    const blob = new Blob([bytes as BlobPart], { type: 'application/octet-stream' });
    const element = document.createElement('a');
    element.setAttribute('href', URL.createObjectURL(blob));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    console.log('✅ Excel report downloaded');
  };

  const successCount = evaluationResults.filter(r => !r.error).length;
  const errorCount = evaluationResults.filter(r => r.error).length;

  return (
    <div className="report-generator-container">
      <h2 className="report-section-title">📄 Generate Report</h2>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <div>
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="report-stats">
        <div className="stat-item">
          <span className="stat-label">Total Records</span>
          <span className="stat-value">{evaluationResults.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Successful</span>
          <span className="stat-value success">{successCount}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Errors</span>
          <span className="stat-value error">{errorCount}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Metrics Used</span>
          <span className="stat-value">{metricsUsed.length}</span>
        </div>
      </div>

      <div className="report-actions">
        <button
          className="btn btn-primary"
          onClick={() => handleGenerateReports('html')}
          disabled={loading || evaluationResults.length === 0}
        >
          {loading ? '⏳ Generating...' : '📊'} HTML Report
        </button>
        <button
          className="btn btn-primary"
          onClick={() => handleGenerateReports('excel')}
          disabled={loading || evaluationResults.length === 0}
        >
          {loading ? '⏳ Generating...' : '📑'} Excel Report
        </button>
        <button
          className="btn btn-primary"
          onClick={() => handleGenerateReports('both')}
          disabled={loading || evaluationResults.length === 0}
        >
          {loading ? '⏳ Generating...' : '📦'} Both Reports
        </button>
      </div>

      {!evaluationResults.length && (
        <div className="empty-state">
          <p>Run batch evaluation first to generate reports</p>
        </div>
      )}
    </div>
  );
};

export default ReportGenerator;
