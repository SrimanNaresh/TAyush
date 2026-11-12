// Excel / CSV template, export and import helpers. exceljs is loaded only when
// one of these runs, so it stays out of the main bundle.

const loadExcel = async () => (await import('exceljs')).default;

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// columns: [{ header, key, width }]
export async function downloadXlsx(name, sheetName, columns, rows, notes) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 18 }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E7490' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  rows.forEach((r) => ws.addRow(r));
  columns.forEach((c, i) => { if (c.text) ws.getColumn(i + 1).numFmt = '@'; });
  if (notes?.length) {
    const n = wb.addWorksheet('Instructions');
    n.getColumn(1).width = 100;
    notes.forEach((t) => n.addRow([t]));
    n.getRow(1).font = { bold: true };
  }
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
}

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function downloadCsv(name, columns, rows) {
  const lines = [columns.map((c) => csvCell(c.header)).join(',')];
  rows.forEach((r) => lines.push(columns.map((c) => csvCell(r[c.key])).join(',')));
  download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), name);
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function cellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    // Excel dates come as UTC midnight.
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return cellText(v.result);
    return '';
  }
  return String(v).trim();
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Reads the first sheet (xlsx) or a CSV. columns: [{ key, header, aliases? }].
// Returns [{ row: <sheet row number>, [key]: text }], skipping empty rows.
export async function readSheet(file, columns) {
  let grid;
  if (/\.csv$/i.test(file.name)) {
    grid = parseCsv((await file.text()).replace(/^﻿/, ''));
  } else if (/\.xlsx$/i.test(file.name)) {
    const ExcelJS = await loadExcel();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    if (!ws) throw new Error('The workbook has no sheets');
    grid = [];
    ws.eachRow({ includeEmpty: true }, (r, n) => {
      const vals = [];
      for (let c = 1; c <= ws.columnCount; c++) vals.push(cellText(r.getCell(c).value));
      grid[n - 1] = vals;
    });
    for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = [];
  } else {
    throw new Error('Choose an .xlsx or .csv file');
  }
  if (!grid.length) throw new Error('The file is empty');
  const head = grid[0].map(norm);
  const idx = {};
  columns.forEach((c) => {
    const names = [c.header, c.key, ...(c.aliases || [])].map(norm);
    idx[c.key] = head.findIndex((h) => names.includes(h));
  });
  const missing = columns.filter((c) => c.required && idx[c.key] < 0).map((c) => c.header);
  if (missing.length) throw new Error(`Missing column(s): ${missing.join(', ')}. Download the template to see the expected layout.`);
  const out = [];
  for (let i = 1; i < grid.length; i++) {
    const r = { row: i + 1 };
    let any = false;
    columns.forEach((c) => {
      const v = idx[c.key] >= 0 ? String(grid[i][idx[c.key]] ?? '').trim() : '';
      r[c.key] = v;
      if (v) any = true;
    });
    if (any) out.push(r);
  }
  if (!out.length) throw new Error('The file has no data rows');
  return out;
}

// Accepts YYYY-MM-DD, DD-MM-YYYY or DD/MM/YYYY; returns YYYY-MM-DD or the original text.
export function normDate(s) {
  if (!s) return '';
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s;
}
