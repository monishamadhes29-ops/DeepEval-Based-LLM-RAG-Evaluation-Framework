/**
 * Dataset from Excel file
 */
export interface Dataset {
  [key: string]: string | number | boolean | null;
}

/**
 * Single sheet data from Excel
 */
export interface SheetData {
  sheetName: string;
  data: Dataset[];
  rowCount: number;
  columnNames: string[];
}

/**
 * Excel parse response from backend
 */
export interface ExcelParseResponse {
  success: boolean;
  fileName: string;
  sheetNames: string[];
  datasets: SheetData[];
  totalDatasets: number;
}

/**
 * Batch evaluation state
 */
export interface BatchEvalState {
  excelFile: File | null;
  fileSelected: boolean;
  parseResult: ExcelParseResponse | null;
  isLoading: boolean;
  error: string | null;
  selectedSheet: string | null;
  jsonData: Dataset[] | null;
}
