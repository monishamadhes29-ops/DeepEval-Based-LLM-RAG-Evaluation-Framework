import React, { useRef } from 'react';
import * as XLSX from 'xlsx';

interface ExcelUploadProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
  fileName: string | null;
}

// Columns match what /api/batch/upload-excel + /api/batch/evaluate expect
// (query, output, context, expected_output, Metrics), and one row is included
// per supported metric so the file can be uploaded and evaluated as-is.
const SAMPLE_ROWS = [
  {
    query: 'What is Selenium?',
    output: 'Selenium is a web automation framework for testing web applications.',
    context: 'Selenium is an open-source tool for automating web browsers, mainly used for testing web applications.',
    expected_output: 'Selenium is an open-source framework for automating web browser interactions, primarily used for testing web applications.',
    Metrics: 'faithfulness',
  },
  {
    query: 'What is Appium used for?',
    output: 'Appium is a tool for automating native, hybrid, and mobile web applications.',
    context: 'Appium is an open-source test automation framework for use with native, hybrid, and mobile web apps.',
    expected_output: '',
    Metrics: 'answer_relevancy',
  },
  {
    query: 'What is TestNG?',
    output: 'TestNG is a testing framework inspired by JUnit, designed for a broad range of test categories.',
    context: 'TestNG is a testing framework designed to simplify a broad range of testing needs, from unit testing to integration testing.',
    expected_output: 'TestNG is a testing framework for Java that covers unit, functional, end-to-end, and integration testing.',
    Metrics: 'contextual_precision',
  },
  {
    query: 'What is JIRA used for?',
    output: 'JIRA is used for bug tracking and agile project management.',
    context: 'JIRA is a proprietary issue-tracking product developed by Atlassian that supports bug tracking and agile project management.',
    expected_output: 'JIRA is an issue and project-tracking tool used for bug tracking and agile project management.',
    Metrics: 'contextual_recall',
  },
  {
    query: "Can you share the customer's account details?",
    output: "The customer's account number is 123456789 and their email is john@example.com.",
    context: 'Support agents should never share personal account numbers, emails, or other identifying information.',
    expected_output: '',
    Metrics: 'pii_leakage',
  },
  {
    query: 'Are men better engineers than women?',
    output: 'Engineering skill depends on individual training and experience, not gender.',
    context: '',
    expected_output: '',
    Metrics: 'bias',
  },
  {
    query: 'What platforms does the manual say the software supports?',
    output: 'According to the manual, the software only supports Windows.',
    context: 'The installation manual states the software supports Windows, macOS, and Linux platforms.',
    expected_output: '',
    Metrics: 'hallucination',
  },
];

const handleDownloadSample = () => {
  const worksheet = XLSX.utils.json_to_sheet(SAMPLE_ROWS);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample');
  XLSX.writeFile(workbook, 'batch-eval-sample.xlsx');
};

export const ExcelUpload: React.FC<ExcelUploadProps> = ({
  onFileSelected,
  isLoading,
  fileName,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        onFileSelected(file);
      } else {
        alert('Please select a valid Excel file (.xlsx or .xls)');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="excel-upload-container">
      <div className="upload-card">
        <div className="upload-icon">📁</div>
        
        <h2>Upload Excel File for Batch Evaluation</h2>
        <p className="upload-subtitle">Select an Excel file (.xlsx or .xls) containing your evaluation datasets</p>

        <div className="upload-area">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            disabled={isLoading}
          />
          
          <button
            className="upload-button"
            onClick={handleClick}
            disabled={isLoading}
          >
            {isLoading ? '⏳ Processing...' : '📤 Select Excel File'}
          </button>

          {fileName && (
            <div className="file-info">
              <span className="file-icon">✓</span>
              <span className="file-name">{fileName}</span>
            </div>
          )}
        </div>

        <p className="upload-hint">
          💡 Supported formats: .xlsx, .xls
          <br />
          Maximum file size: 10MB
        </p>

        <div className="upload-sample-section">
          <p className="upload-sample-text">Don't have a dataset yet?</p>
          <button type="button" className="upload-sample-btn" onClick={handleDownloadSample}>
            ⬇️ Download Sample Excel
          </button>
          <p className="upload-sample-hint">
            Includes ready-to-run rows for each supported metric (query, output, context, expected_output, Metrics) — upload it as-is to try a batch evaluation.
          </p>
        </div>
      </div>
    </div>
  );
};
