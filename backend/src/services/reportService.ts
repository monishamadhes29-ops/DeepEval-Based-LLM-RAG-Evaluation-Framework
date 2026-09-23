import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

export interface ReportData {
  originalData: any[];
  evaluationResults: any[];
  totalRecords: number;
  successCount: number;
  errorCount: number;
  metricsUsed: string[];
  reportTitle?: string; // defaults to "Batch Evaluation Report"; single-eval reports pass "Evaluation Report"
}

/**
 * Generate HTML report from evaluation results
 */
export function generateHTMLReport(data: ReportData): string {
  const metricsStats = calculateMetricsStats(data.evaluationResults);
  const scoreDistribution = calculateScoreDistribution(data.evaluationResults);
  const reportTitle = data.reportTitle || 'Batch Evaluation Report';

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }

    .report-container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 40px;
    }

    .report-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      border-radius: 12px;
      margin-bottom: 40px;
      text-align: center;
    }

    .report-header h1 {
      font-size: 32px;
      margin-bottom: 10px;
    }

    .report-header p {
      font-size: 14px;
      opacity: 0.9;
    }

    .timestamp {
      font-size: 12px;
      opacity: 0.8;
      margin-top: 10px;
    }

    .summary-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .summary-card {
      background: #f9f9f9;
      border: 2px solid #e0e0e0;
      border-radius: 10px;
      padding: 20px;
      text-align: center;
    }

    .summary-card h3 {
      font-size: 24px;
      color: #667eea;
      margin-bottom: 5px;
    }

    .summary-card p {
      font-size: 13px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .charts-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 30px;
      margin-bottom: 40px;
    }

    .chart-container {
      background: #f9f9f9;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      padding: 20px;
      position: relative;
      min-height: 300px;
    }

    .chart-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 15px;
      color: #333;
    }

    .metrics-section {
      margin-bottom: 40px;
    }

    .metrics-section h2 {
      font-size: 20px;
      margin-bottom: 20px;
      color: #333;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
    }

    .metric-badge {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
      font-size: 13px;
      font-weight: 600;
    }

    .metric-badge .metric-name {
      text-transform: capitalize;
      margin-bottom: 5px;
      display: block;
    }

    .metric-badge .metric-count {
      font-size: 18px;
      font-weight: 700;
    }

    .results-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 40px;
      font-size: 13px;
    }

    .results-table thead {
      background: #f5f5f5;
    }

    .results-table th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #333;
      border-bottom: 2px solid #e0e0e0;
    }

    .results-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #f0f0f0;
    }

    .results-table tr:hover {
      background: #fafafa;
    }

    .status-success {
      color: #4caf50;
      font-weight: 600;
    }

    .status-error {
      color: #f44336;
      font-weight: 600;
    }

    .score-cell {
      font-weight: 600;
      font-family: 'Courier New', monospace;
    }

    .score-excellent {
      color: #1b5e20;
    }

    .score-good {
      color: #33691e;
    }

    .score-fair {
      color: #e65100;
    }

    .score-poor {
      color: #bf360c;
    }

    .verdict-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .verdict-pass {
      background: #c8e6c9;
      color: #2e7d32;
    }

    .verdict-fail {
      background: #ffcdd2;
      color: #c62828;
    }

    .verdicts-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      line-height: 1.4;
    }

    .footer {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      color: #999;
      font-size: 12px;
    }

    @media (max-width: 768px) {
      .report-container {
        padding: 20px;
      }

      .report-header {
        padding: 20px;
      }

      .report-header h1 {
        font-size: 24px;
      }

      .charts-section {
        grid-template-columns: 1fr;
      }

      .results-table {
        font-size: 11px;
      }

      .results-table th,
      .results-table td {
        padding: 8px;
      }
    }

    @page {
      size: A4;
      margin: 20mm;
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="report-header">
      <h1>📊 ${reportTitle}</h1>
      <p>Comprehensive evaluation results and metrics analysis</p>
      <div class="timestamp">${new Date().toLocaleString()}</div>
    </div>

    <div class="summary-section">
      <div class="summary-card">
        <h3>${data.totalRecords}</h3>
        <p>Total Records</p>
      </div>
      <div class="summary-card">
        <h3>${data.successCount}</h3>
        <p>Successful Evaluations</p>
      </div>
      <div class="summary-card">
        <h3>${data.errorCount}</h3>
        <p>Errors</p>
      </div>
      <div class="summary-card">
        <h3>${((data.successCount / data.totalRecords) * 100).toFixed(1)}%</h3>
        <p>Success Rate</p>
      </div>
    </div>

    <div class="metrics-section">
      <h2>📈 Metrics Used</h2>
      <div class="metrics-grid">
        ${data.metricsUsed.map(metric => {
          const count = data.evaluationResults.filter(r => r.metric_name === metric).length;
          return `<div class="metric-badge">
            <span class="metric-name">${metric.replace(/_/g, ' ')}</span>
            <span class="metric-count">${count}</span>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="charts-section">
      <div class="chart-container">
        <div class="chart-title">📊 Score Distribution</div>
        <canvas id="scoreChart"></canvas>
      </div>
      <div class="chart-container">
        <div class="chart-title">✅ Results Breakdown</div>
        <canvas id="statusChart"></canvas>
      </div>
    </div>

    <div class="metrics-section">
      <h2>📋 Detailed Results</h2>
      <table class="results-table">
        <thead>
          <tr>
            <th>Row</th>
            <th>Metric</th>
            <th>Status</th>
            <th>Score</th>
            <th>Verdict</th>
          </tr>
        </thead>
        <tbody>
          ${data.evaluationResults.map((result, idx) => {
            // Handle "all" metrics - calculate average score for coloring
            let displayScore = '';
            let displayVerdict = '';
            let scoreForColoring = 0;
            
            if (result.metricsResults && Array.isArray(result.metricsResults)) {
              // For "all" metrics, show all scores and calculate average
              displayScore = result.metricsResults
                .filter((m: any) => m.score !== undefined && m.score !== null)
                .map((m: any) => `${m.metric_name}: ${Number(m.score).toFixed(3)}`)
                .join('<br/>');
              
              displayVerdict = result.metricsResults
                .map((m: any) => `${m.metric_name}: ${m.verdict || 'N/A'}`)
                .join('<br/>');
              
              // Calculate average for coloring
              const validScores = result.metricsResults
                .filter((m: any) => m.score !== undefined && m.score !== null)
                .map((m: any) => Number(m.score));
              if (validScores.length > 0) {
                scoreForColoring = validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length;
              }
            } else {
              // Single metric case
              displayScore = result.error ? '' : (result.score?.toFixed(3) || '');
              displayVerdict = result.error ? '' : (result.verdict || '');
              scoreForColoring = result.score || 0;
            }
            
            const scoreClass = result.error ? '' : 
              scoreForColoring >= 0.8 ? 'score-excellent' :
              scoreForColoring >= 0.6 ? 'score-good' :
              scoreForColoring >= 0.4 ? 'score-fair' : 'score-poor';
            
            const verdictClass = result.error ? '' :
              result.verdict?.toLowerCase() === 'yes' ? 'verdict-pass' : 'verdict-fail';

            return `
            <tr>
              <td>${result.rowIndex}</td>
              <td>${result.metric_name.replace(/_/g, ' ')}</td>
              <td class="${result.error ? 'status-error' : 'status-success'}">
                ${result.error ? '✗ Error' : '✓ Success'}
              </td>
              <td class="score-cell ${scoreClass}">
                ${result.error ? '—' : displayScore || '—'}
              </td>
              <td>
                ${result.error ? '—' : displayVerdict ? 
                  `<div class="verdicts-list">${displayVerdict}</div>` : '—'}
              </td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>Generated on ${new Date().toLocaleString()}</p>
      <p>&copy; ${new Date().getFullYear()} Testleaf. All rights reserved.</p>
    </div>
  </div>

  <script>
    // Score Distribution Chart
    const scoreData = ${JSON.stringify(scoreDistribution)};
    const scoreCtx = document.getElementById('scoreChart').getContext('2d');
    new Chart(scoreCtx, {
      type: 'bar',
      data: {
        labels: ['Excellent (0.8-1.0)', 'Good (0.6-0.8)', 'Fair (0.4-0.6)', 'Poor (0-0.4)'],
        datasets: [{
          label: 'Number of Records',
          data: [scoreData.excellent, scoreData.good, scoreData.fair, scoreData.poor],
          backgroundColor: ['#1b5e20', '#33691e', '#e65100', '#bf360c'],
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });

    // Status Chart
    const statusCtx = document.getElementById('statusChart').getContext('2d');
    new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['Success', 'Error'],
        datasets: [{
          data: [${data.successCount}, ${data.errorCount}],
          backgroundColor: ['#4caf50', '#f44336'],
          borderColor: white,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  </script>
</body>
</html>
  `;

  return htmlContent;
}

/**
 * Generate Excel report from evaluation results with summary and charts
 */
export async function generateExcelReport(data: ReportData): Promise<Buffer> {
  const reportTitle = data.reportTitle || 'Batch Evaluation Report';
  const workbook = new ExcelJS.Workbook();

  // Sheet 1: Summary with Statistics
  const summarySheet = workbook.addWorksheet('Summary');
  
  // Set column widths
  summarySheet.columns = [
    { width: 25 },
    { width: 20 },
    { width: 3 },
    { width: 25 },
    { width: 20 }
  ];

  // Title
  summarySheet.mergeCells('A1:B1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = `${reportTitle} Summary`;
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF667EEA' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  summarySheet.getRow(1).height = 30;

  // Generated date
  summarySheet.mergeCells('A2:B2');
  const dateCell = summarySheet.getCell('A2');
  dateCell.value = `Generated: ${new Date().toLocaleString()}`;
  dateCell.font = { size: 11, color: { argb: 'FF999999' } };
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Empty row
  summarySheet.getRow(3).height = 10;

  // Statistics Section
  summarySheet.getCell('A4').value = 'Summary Statistics';
  summarySheet.getCell('A4').font = { bold: true, size: 12, color: { argb: 'FF333333' } };

  const stats = [
    { label: 'Total Records', value: data.totalRecords },
    { label: 'Successful', value: data.successCount },
    { label: 'Errors', value: data.errorCount },
    { label: 'Success Rate (%)', value: ((data.successCount / data.totalRecords) * 100).toFixed(2) },
  ];

  let row = 5;
  stats.forEach(({ label, value }) => {
    summarySheet.getCell(`A${row}`).value = label;
    summarySheet.getCell(`A${row}`).font = { bold: true, color: { argb: 'FF333333' } };
    summarySheet.getCell(`B${row}`).value = value;
    summarySheet.getCell(`B${row}`).font = { size: 12, color: { argb: 'FF667EEA' }, bold: true };
    row++;
  });

  // Results Breakdown Section (on the right)
  summarySheet.mergeCells('D4:E4');
  summarySheet.getCell('D4').value = 'Results Breakdown';
  summarySheet.getCell('D4').font = { bold: true, size: 12, color: { argb: 'FF333333' } };
  summarySheet.getCell('D4').alignment = { horizontal: 'center', vertical: 'middle' };

  summarySheet.getCell('D5').value = 'Status';
  summarySheet.getCell('D5').font = { bold: true };
  summarySheet.getCell('E5').value = 'Count';
  summarySheet.getCell('E5').font = { bold: true };

  // Breakdown data
  summarySheet.getCell('D6').value = 'Success';
  summarySheet.getCell('E6').value = data.successCount;
  summarySheet.getCell('E6').font = { bold: true, color: { argb: 'FF4CAF50' } };
  summarySheet.getCell('E6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8E6C9' } };

  summarySheet.getCell('D7').value = 'Error';
  summarySheet.getCell('E7').value = data.errorCount;
  summarySheet.getCell('E7').font = { bold: true, color: { argb: 'FFF44336' } };
  summarySheet.getCell('E7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDD2' } };

  // Empty row
  row = 9;

  // Metrics Used Section
  summarySheet.getCell(`A${row}`).value = 'Metrics Used';
  summarySheet.getCell(`A${row}`).font = { bold: true, size: 12, color: { argb: 'FF333333' } };
  summarySheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };

  summarySheet.getCell(`B${row}`).value = 'Count';
  summarySheet.getCell(`B${row}`).font = { bold: true, color: { argb: 'FF333333' } };
  summarySheet.getCell(`B${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };

  row++;
  data.metricsUsed.forEach(metric => {
    const count = data.evaluationResults.filter((r: any) => r.metric_name === metric).length;
    summarySheet.getCell(`A${row}`).value = metric.replace(/_/g, ' ');
    summarySheet.getCell(`B${row}`).value = count;
    summarySheet.getCell(`B${row}`).font = { bold: true, color: { argb: 'FF667EEA' } };
    row++;
  });

  // Sheet 2: Detailed Results
  const resultsSheet = workbook.addWorksheet('Results');
  
  const resultsHeaders = ['Row', 'Metric', 'Status', 'Score', 'Verdict', 'Explanation'];
  resultsSheet.addRow(resultsHeaders);
  
  // Style header row
  resultsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF667EEA' }
  };
  
  resultsSheet.getRow(1).font = {
    bold: true,
    color: { argb: 'FFFFFFFF' }
  };

  data.evaluationResults.forEach((result: any) => {
    let scoreDisplay = '';
    let verdictDisplay = '';
    let scoreForColoring = 0;
    
    // Handle "all" metrics - extract scores from metricsResults array
    if (result.metricsResults && Array.isArray(result.metricsResults)) {
      const validScores = result.metricsResults
        .filter((m: any) => m.score !== undefined && m.score !== null)
        .map((m: any) => Number(m.score));
      
      // Show individual metric scores
      scoreDisplay = result.metricsResults
        .filter((m: any) => m.score !== undefined && m.score !== null)
        .map((m: any) => `${m.metric_name}: ${Number(m.score).toFixed(3)}`)
        .join(', ');
      
      // For verdict, combine all verdicts
      verdictDisplay = result.metricsResults
        .map((m: any) => m.verdict || 'N/A')
        .join(', ');
      
      // Calculate average for coloring
      if (validScores.length > 0) {
        scoreForColoring = validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length;
      }
      console.log(`📋 Results sheet Row${result.rowIndex}: "all" metrics scoreDisplay="${scoreDisplay.substring(0, 50)}..."`);
    } else if (!result.error) {
      // Single metric case
      scoreDisplay = result.score?.toFixed(3) || '';
      verdictDisplay = result.verdict || '';
      scoreForColoring = result.score || 0;
      console.log(`📋 Results sheet Row${result.rowIndex}: Single metric scoreDisplay="${scoreDisplay}"`);
    } else {
      console.log(`📋 Results sheet Row${result.rowIndex}: ERROR (no score)`);
    }
    
    const newRow = resultsSheet.addRow([
      result.rowIndex,
      result.metric_name.replace(/_/g, ' '),
      result.error ? 'Error' : 'Success',
      result.error ? '' : scoreDisplay,
      result.error ? '' : verdictDisplay,
      result.error || result.explanation?.substring(0, 100) || '',
    ]);

    // Color code the score
    if (!result.error && scoreForColoring > 0) {
      const scoreCell = newRow.getCell(4);
      if (scoreForColoring >= 0.8) {
        scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
        scoreCell.font = { color: { argb: 'FF1B5E20' }, bold: true };
      } else if (scoreForColoring >= 0.6) {
        scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F8E9' } };
        scoreCell.font = { color: { argb: 'FF33691E' }, bold: true };
      } else if (scoreForColoring >= 0.4) {
        scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
        scoreCell.font = { color: { argb: 'FFE65100' }, bold: true };
      } else if (scoreForColoring > 0) {
        scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } };
        scoreCell.font = { color: { argb: 'FFBF360C' }, bold: true };
      }
    }
  });

  // Set column widths
  resultsSheet.getColumn('A').width = 8;
  resultsSheet.getColumn('B').width = 18;
  resultsSheet.getColumn('C').width = 12;
  resultsSheet.getColumn('D').width = 10;
  resultsSheet.getColumn('E').width = 12;
  resultsSheet.getColumn('F').width = 40;

  // Sheet 3: Score Distribution
  const chartSheet = workbook.addWorksheet('Score Distribution');
  
  const scoreDistribution = calculateScoreDistribution(data.evaluationResults);
  
  // Title
  chartSheet.mergeCells('A1:C1');
  chartSheet.getCell('A1').value = 'Score Distribution Analysis';
  chartSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF667EEA' } };
  chartSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  chartSheet.getRow(1).height = 25;

  chartSheet.getRow(2).height = 5;

  // Headers
  chartSheet.getCell('A3').value = 'Score Range';
  chartSheet.getCell('B3').value = 'Count';
  chartSheet.getCell('C3').value = 'Percentage';
  
  [chartSheet.getCell('A3'), chartSheet.getCell('B3'), chartSheet.getCell('C3')].forEach(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF764BA2' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Data rows
  const scoreRanges = [
    { label: 'Excellent (0.8-1.0)', value: scoreDistribution.excellent, color: 'FFE8F5E9' },
    { label: 'Good (0.6-0.8)', value: scoreDistribution.good, color: 'FFF1F8E9' },
    { label: 'Fair (0.4-0.6)', value: scoreDistribution.fair, color: 'FFFFF3E0' },
    { label: 'Poor (0-0.4)', value: scoreDistribution.poor, color: 'FFFFE0B2' },
  ];

  const totalEvaluated = data.evaluationResults.filter((r: any) => !r.error).length;

  let dataRow = 4;
  scoreRanges.forEach(({ label, value, color }) => {
    const percentage = totalEvaluated > 0 ? ((value / totalEvaluated) * 100).toFixed(1) : 0;
    
    chartSheet.getCell(`A${dataRow}`).value = label;
    chartSheet.getCell(`B${dataRow}`).value = value;
    chartSheet.getCell(`C${dataRow}`).value = `${percentage}%`;

    // Style the row
    [chartSheet.getCell(`A${dataRow}`), chartSheet.getCell(`B${dataRow}`), chartSheet.getCell(`C${dataRow}`)].forEach(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = { bold: true };
    });

    dataRow++;
  });

  // Total row
  chartSheet.getCell(`A${dataRow}`).value = 'Total';
  chartSheet.getCell(`B${dataRow}`).value = totalEvaluated;
  chartSheet.getCell(`B${dataRow}`).font = { bold: true };
  chartSheet.getCell(`B${dataRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };

  chartSheet.getColumn('A').width = 20;
  chartSheet.getColumn('B').width = 12;
  chartSheet.getColumn('C').width = 12;

  // Sheet 4: Original Data + Scores
  if (data.originalData && data.originalData.length > 0) {
    const dataSheet = workbook.addWorksheet('Data with Scores');
    
    const originalHeaders = Object.keys(data.originalData[0]);
    const headersWithScores = [
      ...originalHeaders,
      'Evaluation_Status',
      'Evaluation_Metric',
      'Evaluation_Score',
      'Evaluation_Verdict',
    ];
    
    const headerRow = dataSheet.addRow(headersWithScores);
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF764BA2' }
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Debug: Check metricsResults in data
    const allMetricsCount = data.evaluationResults.filter((r: any) => r.metricsResults).length;
    console.log(`📊 Data with Scores sheet: ${allMetricsCount} results with metricsResults`);

    data.originalData.forEach((original, idx) => {
      const result = data.evaluationResults.find((r: any) => r.rowIndex === idx + 1);
      
      console.log(`  Row ${idx + 1}: result check:`, {
        hasMetricsResults: !!result?.metricsResults,
        isArray: Array.isArray(result?.metricsResults),
        metricsResultsLength: result?.metricsResults?.length,
        allMetrics: result?.allMetrics,
        metric_name: result?.metric_name,
        hasScore: result?.score !== undefined
      });
      
      // Handle "all" metrics - extract scores from metricsResults array
      let scoreDisplay = '';
      let verdictDisplay = '';
      if (result?.metricsResults && Array.isArray(result.metricsResults)) {
        // For "all" metrics, show scores for each metric in a readable format
        const scoreStrings = result.metricsResults
          .filter((m: any) => m.score !== undefined && m.score !== null)
          .map((m: any) => `${m.metric_name}: ${Number(m.score).toFixed(3)}`)
          .join('; ');
        scoreDisplay = scoreStrings;
        
        console.log(`  Row ${idx + 1}: scoreDisplay set to: "${scoreDisplay.substring(0, 50)}..."`);
        
        // For verdict, combine all verdicts
        verdictDisplay = result.metricsResults
          .map((m: any) => m.verdict || 'N/A')
          .join('; ');
      } else if (!result?.error) {
        // Single metric case
        scoreDisplay = result?.score?.toFixed(3) || '';
        console.log(`  Row ${idx + 1}: single metric scoreDisplay: "${scoreDisplay}"`);
        verdictDisplay = result?.verdict || '';
      }
      
      const rowData = [
        ...originalHeaders.map(h => original[h]),
        result?.error ? 'Error' : 'Success',
        result?.metric_name?.replace(/_/g, ' ') || '',
        result?.error ? '' : scoreDisplay,
        result?.error ? '' : verdictDisplay,
      ];
      dataSheet.addRow(rowData);
    });

    // Auto-fit columns
    headersWithScores.forEach((_, idx) => {
      dataSheet.getColumn(idx + 1).width = 15;
    });
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}

/**
 * Calculate metrics statistics
 */
function calculateMetricsStats(results: any[]): Record<string, number> {
  const stats: Record<string, number> = {};
  results.forEach(result => {
    const metric = result.metric_name;
    stats[metric] = (stats[metric] || 0) + 1;
  });
  return stats;
}

/**
 * Calculate score distribution
 */
function calculateScoreDistribution(results: any[]): Record<string, number> {
  let excellent = 0;
  let good = 0;
  let fair = 0;
  let poor = 0;

  results.forEach(result => {
    if (result.error) return;
    
    let score = 0;
    
    // Handle "all" metrics - calculate average score from metricsResults
    if (result.metricsResults && Array.isArray(result.metricsResults)) {
      const validScores = result.metricsResults
        .filter((m: any) => m.score !== undefined && m.score !== null)
        .map((m: any) => Number(m.score));
      
      if (validScores.length > 0) {
        score = validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length;
      }
    } else {
      // Single metric case
      score = result.score || 0;
    }
    
    if (score >= 0.8) excellent++;
    else if (score >= 0.6) good++;
    else if (score >= 0.4) fair++;
    else poor++;
  });

  return { excellent, good, fair, poor };
}
