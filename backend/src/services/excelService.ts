import XLSX from 'xlsx';
import { Express } from 'express';

/**
 * Excel Dataset interface
 */
export interface ExcelDataset {
  [key: string]: string | number | boolean | null;
}

/**
 * Excel File Response interface
 */
export interface ExcelParseResponse {
  fileName: string;
  sheetNames: string[];
  datasets: {
    sheetName: string;
    data: ExcelDataset[];
    rowCount: number;
    columnNames: string[];
  }[];
  totalDatasets: number;
}

/**
 * Parse Excel file and extract all sheets with their data
 * 
 * @param filePath - Path to the Excel file
 * @returns Parsed data from all sheets
 */
export async function parseExcelFile(filePath: string): Promise<ExcelParseResponse> {
  try {
    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;

    const datasets = sheetNames.map((sheetName) => {
      // Get worksheet
      const worksheet = workbook.Sheets[sheetName];

      // Convert worksheet to JSON (array of objects)
      const data: ExcelDataset[] = XLSX.utils.sheet_to_json(worksheet);

      // Get column names from first row
      const columnNames = data.length > 0 ? Object.keys(data[0]) : [];

      return {
        sheetName,
        data,
        rowCount: data.length,
        columnNames,
      };
    });

    const fileName = filePath.split('/').pop() || filePath;

    return {
      fileName,
      sheetNames,
      datasets,
      totalDatasets: datasets.reduce((sum, sheet) => sum + sheet.rowCount, 0),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to parse Excel file: ${errorMessage}`);
  }
}

/**
 * Convert Excel datasets to JSON format for display
 * 
 * @param datasets - Array of Excel datasets from parseExcelFile
 * @returns JSON stringified data
 */
export function datasetsToJSON(datasets: ExcelDataset[]): string {
  return JSON.stringify(datasets, null, 2);
}

/**
 * Get specific sheet data
 * 
 * @param filePath - Path to the Excel file
 * @param sheetName - Name of the sheet to extract
 * @returns Data from the specified sheet
 */
export async function getSheetData(
  filePath: string,
  sheetName: string
): Promise<ExcelDataset[]> {
  try {
    const workbook = XLSX.readFile(filePath);

    if (!workbook.SheetNames.includes(sheetName)) {
      throw new Error(`Sheet "${sheetName}" not found in workbook`);
    }

    const worksheet = workbook.Sheets[sheetName];
    const data: ExcelDataset[] = XLSX.utils.sheet_to_json(worksheet);

    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get sheet data: ${errorMessage}`);
  }
}
