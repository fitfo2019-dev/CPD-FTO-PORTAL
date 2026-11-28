import XLSX from 'xlsx-js-style';
import { formTemplateRevision } from './form-revisions.js';

export type PhaseSummaryBranding = { wordmarkSvg: string; patchUrl: string; badgeUrl: string };

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

/** The workbook guards formula-like text with a leading apostrophe; the printed page shows the text as entered. */
const displayText = (value: unknown) => {
  const text = String(value ?? '');
  return /^'[\s\u0000-\u001f]*[=+\-@]/u.test(text) ? text.slice(1) : text;
};

type CellStyle = {
  border?: unknown;
  font?: { sz?: number; bold?: boolean };
  alignment?: { horizontal?: string; vertical?: string };
  fill?: { fgColor?: { rgb?: string } };
};

function sheetTable(sheet: XLSX.WorkSheet): string {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  const merges = sheet['!merges'] ?? [];
  const covered = new Set<string>();
  const spans = new Map<string, { rows: number; cols: number }>();
  for (const merge of merges) {
    spans.set(`${merge.s.r}:${merge.s.c}`, { rows: merge.e.r - merge.s.r + 1, cols: merge.e.c - merge.s.c + 1 });
    for (let r = merge.s.r; r <= merge.e.r; r++) for (let c = merge.s.c; c <= merge.e.c; c++) {
      if (r !== merge.s.r || c !== merge.s.c) covered.add(`${r}:${c}`);
    }
  }
  const columns = sheet['!cols'] ?? [];
  const totalWidth = columns.reduce((sum, column) => sum + (column?.wch ?? 8), 0) || 1;
  const colgroup = columns.map(column => `<col style="width:${(((column?.wch ?? 8) / totalWidth) * 100).toFixed(3)}%">`).join('');
  const body: string[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const heightPt = sheet['!rows']?.[r]?.hpt ?? 18;
    const cells: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (covered.has(`${r}:${c}`)) continue;
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as { v?: unknown; s?: CellStyle } | undefined;
      const style = cell?.s ?? {};
      const span = spans.get(`${r}:${c}`);
      const classes = [
        style.border ? 'b' : 'nb',
        style.font?.bold ? 'bold' : '',
        style.alignment?.horizontal === 'center' ? 'center' : '',
        style.alignment?.vertical === 'top' ? 'top' : '',
      ].filter(Boolean).join(' ');
      const fill = style.fill?.fgColor?.rgb ? `background:#${style.fill.fgColor.rgb.slice(-6)};` : '';
      const size = `font-size:${((style.font?.sz ?? 10) / 10).toFixed(2)}em;`;
      cells.push(`<td class="${classes}"${span && span.cols > 1 ? ` colspan="${span.cols}"` : ''}${span && span.rows > 1 ? ` rowspan="${span.rows}"` : ''} style="${fill}${size}">${escapeHtml(displayText(cell?.v))}</td>`);
    }
    body.push(`<tr style="height:${heightPt <= 8 ? 4 : Math.round(heightPt * 0.62)}pt">${cells.join('')}</tr>`);
  }
  return `<table><colgroup>${colgroup}</colgroup><tbody>${body.join('')}</tbody></table>`;
}

/** One US Letter landscape page per weekly tab of the phase workbook, with the same content and layout. */
export function phaseSummaryHtml(workbook: XLSX.WorkBook, title: string, branding: PhaseSummaryBranding): string {
  const revision = formTemplateRevision('monthly_workbook');
  const pages = workbook.SheetNames.map(name => `<section class="page" data-tab="${escapeHtml(name)}">
  <header class="lockup">
    <span class="wordmark">${branding.wordmarkSvg}</span>
    <span class="titles"><b>DIVISION OF POLICE</b><span>FIELD TRAINING OFFICE</span><em>${escapeHtml(name)}</em></span>
    <img class="patch" src="${escapeHtml(branding.patchUrl)}" alt="">
  </header>
  <div class="fit"><div class="content">${sheetTable(workbook.Sheets[name])}</div></div>
  <footer><img class="badge" src="${escapeHtml(branding.badgeUrl)}" alt=""><span>Template revised ${escapeHtml(revision)}</span></footer>
</section>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
@page { size: letter landscape; margin: 0.5in; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; color: #000; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 10in; height: 7.5in; display: flex; flex-direction: column; overflow: hidden; break-after: page; page-break-after: always; }
.page:last-child { break-after: auto; page-break-after: auto; }
.lockup { display: flex; align-items: center; gap: 0.2in; height: 0.75in; border-bottom: 2px solid #142d4f; padding-bottom: 0.05in; }
.wordmark svg { height: 0.5in; width: auto; display: block; }
.titles { flex: 1; display: flex; flex-direction: column; align-items: center; line-height: 1.2; color: #142d4f; }
.titles b { font-size: 12pt; letter-spacing: 0.04em; }
.titles span { font-size: 9pt; letter-spacing: 0.08em; }
.titles em { font-style: normal; font-size: 9pt; font-weight: bold; color: #000; }
.patch { height: 0.72in; width: auto; }
.fit { flex: 1; min-height: 0; padding-top: 0.06in; }
.content { transform-origin: top left; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 7.5pt; }
td { padding: 1pt 3pt; vertical-align: middle; overflow-wrap: break-word; line-height: 1.15; white-space: pre-wrap; }
td.b { border: 0.6pt solid #000; }
td.nb { border: 0; }
td.bold { font-weight: bold; }
td.center { text-align: center; }
td.top { vertical-align: top; }
footer { height: 0.5in; display: flex; align-items: flex-end; gap: 0.15in; font-size: 6.5pt; }
.badge { height: 0.48in; width: auto; }
</style></head><body>${pages}<script>
for (const page of document.querySelectorAll('.page')) {
  const fit = page.querySelector('.fit');
  const content = page.querySelector('.content');
  const scale = Math.min(1, (fit.clientHeight - 4) / content.scrollHeight);
  if (scale < 1) { content.style.transform = 'scale(' + scale + ')'; content.style.width = (100 / scale) + '%'; }
}
</script></body></html>`;
}
