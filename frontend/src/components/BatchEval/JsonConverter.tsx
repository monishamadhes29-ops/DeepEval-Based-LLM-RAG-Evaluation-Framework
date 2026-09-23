import React, { useState } from 'react';
import { Dataset } from './types';

interface JsonConverterProps {
  data: Dataset[] | null;
  sheetName: string | null;
  onDownload: () => void;
}

type JsonFormat = 'pretty' | 'minified' | 'compact';

export const JsonConverter: React.FC<JsonConverterProps> = ({
  data,
  sheetName,
  onDownload,
}) => {
  const [format, setFormat] = useState<JsonFormat>('pretty');
  const [copied, setCopied] = useState(false);

  if (!data || data.length === 0) {
    return null;
  }

  // Generate JSON based on selected format
  const getJsonString = (fmt: JsonFormat): string => {
    switch (fmt) {
      case 'minified':
        return JSON.stringify(data);
      case 'compact':
        return JSON.stringify(data, null, 1);
      default: // pretty
        return JSON.stringify(data, null, 2);
    }
  };

  const jsonString = getJsonString(format);

  // Copy to clipboard
  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      console.log('✅ JSON copied to clipboard');
    } catch (error) {
      console.error('❌ Failed to copy to clipboard:', error);
    }
  };

  // Calculate statistics
  const totalRecords = data.length;
  const totalFields = data.length > 0 ? Object.keys(data[0]).length : 0;
  const jsonSize = (jsonString.length / 1024).toFixed(2); // KB

  return (
    <div className="json-converter-section">
      <div className="json-header">
        <div className="json-title-group">
          <h3>📋 JSON Data Converter</h3>
          <span className="sheet-label">{sheetName}</span>
        </div>

        <div className="json-actions">
          <div className="format-selector">
            <label>Format:</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as JsonFormat)}
              className="format-dropdown"
            >
              <option value="pretty">Pretty Print</option>
              <option value="compact">Compact</option>
              <option value="minified">Minified</option>
            </select>
          </div>

          <button
            className={`btn-copy-json ${copied ? 'copied' : ''}`}
            onClick={handleCopyToClipboard}
            title="Copy JSON to clipboard"
          >
            {copied ? '✓ Copied!' : '📋 Copy JSON'}
          </button>

          <button className="btn-download-json" onClick={onDownload} title="Download as JSON file">
            💾 Download JSON
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="json-statistics">
        <div className="stat-item">
          <span className="stat-icon">📊</span>
          <span className="stat-text">
            <strong>{totalRecords}</strong> Records
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-icon">🏷️</span>
          <span className="stat-text">
            <strong>{totalFields}</strong> Fields
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-icon">📦</span>
          <span className="stat-text">
            <strong>{jsonSize}</strong> KB
          </span>
        </div>
      </div>

      {/* JSON Content with Syntax Highlighting */}
      <div className="json-display-wrapper">
        <div className="json-container">
          <pre className="json-content">
            <code className="json-code">{jsonString}</code>
          </pre>
        </div>

        {/* Info Banner */}
        <div className="json-info-banner">
          ℹ️ This JSON is ready to be used for batch evaluation in Step 3
        </div>
      </div>
    </div>
  );
};
