// ============================================================
// Castro Agency Hub — CSV Export Utility
// Place this file at: src/utils/csv.js
// ============================================================

/**
 * Generates and triggers a CSV download in the browser.
 *
 * @param {string}   filename - e.g. 'sales-2025-05.csv'
 * @param {string[]} headers  - Column header labels
 * @param {Array[]}  rows     - Array of arrays (one per row)
 */
export function exportCSV(filename, headers, rows) {
  function escape(v) {
    if (v === null || v === undefined) return ''
    const s = String(v)
    // Wrap in quotes if value contains comma, quote, or newline
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }

  const lines = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(escape).join(',')),
  ]
  const csv  = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
