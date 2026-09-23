import React from 'react';
import { SheetData, Dataset } from './types';

interface DatasetPreviewProps {
  sheetsData: SheetData[];
  selectedSheet: string | null;
  onSheetSelect: (sheetName: string) => void;
}

export const DatasetPreview: React.FC<DatasetPreviewProps> = ({
  sheetsData,
  selectedSheet,
  onSheetSelect,
}) => {
  const activeSheet = sheetsData.find((sheet) => sheet.sheetName === selectedSheet);

  return (
    <div className="dataset-preview-container">
      <h2>📊 Dataset Preview</h2>

      {/* Sheet Tabs */}
      {sheetsData.length > 1 && (
        <div className="sheet-tabs">
          {sheetsData.map((sheet) => (
            <button
              key={sheet.sheetName}
              className={`sheet-tab ${selectedSheet === sheet.sheetName ? 'active' : ''}`}
              onClick={() => onSheetSelect(sheet.sheetName)}
            >
              {sheet.sheetName}
              <span className="row-count">{sheet.rowCount}</span>
            </button>
          ))}
        </div>
      )}

      {activeSheet && (
        <div className="sheet-content">
          <div className="sheet-info">
            <p className="sheet-title">
              📋 <strong>{activeSheet.sheetName}</strong>
            </p>
            <p className="sheet-stats">
              Rows: <strong>{activeSheet.rowCount}</strong> | Columns: <strong>{activeSheet.columnNames.length}</strong>
            </p>
          </div>

          {/* Data Table */}
          {activeSheet.data.length > 0 ? (
            <div className="table-wrapper">
              <table className="dataset-table">
                <thead>
                  <tr>
                    <th className="row-num">#</th>
                    {activeSheet.columnNames.map((colName) => (
                      <th key={colName}>{colName}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeSheet.data.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td className="row-num">{rowIndex + 1}</td>
                      {activeSheet.columnNames.map((colName) => (
                        <td key={`${rowIndex}-${colName}`} className="cell-content">
                          {String(row[colName] ?? '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-sheet">
              <p>No data in this sheet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
