import * as xlsx from 'xlsx';

export function exportToExcel(data: any[], filenamePrefix: string) {
  // Create a new workbook
  const wb = xlsx.utils.book_new();

  // Convert the array of objects to a worksheet
  const ws = xlsx.utils.json_to_sheet(data);

  // Append worksheet to workbook
  xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');

  // Format today's date as YYYY-MM-DD
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  // Generate and download the file
  const filename = `${filenamePrefix}-export-${dateStr}.xlsx`;
  xlsx.writeFile(wb, filename);
}

export function exportMultipleSheetsToExcel(sheets: {name: string, data: any[]}[], filenamePrefix: string) {
  const wb = xlsx.utils.book_new();

  for (const sheet of sheets) {
    const ws = xlsx.utils.json_to_sheet(sheet.data);
    xlsx.utils.book_append_sheet(wb, ws, sheet.name);
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const filename = `${filenamePrefix}-export-${dateStr}.xlsx`;
  xlsx.writeFile(wb, filename);
}
