/** Shared downloader for generated CSVs and worker setup text files. */
export function downloadTextFile(content: string, filename: string, type = 'text/plain;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}

export function downloadCsv(content: string, filename: string): void {
  downloadTextFile(content, filename, 'text/csv;charset=utf-8;');
}

/** Escape a CSV field and prevent a displayed value from becoming a spreadsheet formula. */
export function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}
