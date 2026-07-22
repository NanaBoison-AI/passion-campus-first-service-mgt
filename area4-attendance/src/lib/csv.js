/** Build a CSV string and trigger a browser download. */

export function toCSV(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function downloadCSV(filename, rows) {
  const blob = new Blob(['﻿' + toCSV(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
