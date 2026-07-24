// Renders the three Asahi documents from the golden-master sample to a single
// preview HTML file (no DB needed). Run: node scripts/preview-documents.mjs
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const {
  computePayroll,
  JUNE_2026_ATTENDANCE,
  JUNE_2026_EXPENSES,
  DEFAULT_RATES,
} = await import('../shared/dist/index.js');
const { renderDocumentHtml } = await import('../server/dist/documents/templates.js');
const { periodLabel } = await import('../server/dist/documents/format.js');
const { DEFAULT_DEPARTMENT } = await import('../server/dist/documents/context.js');

const payroll = computePayroll(JUNE_2026_ATTENDANCE, JUNE_2026_EXPENSES, {
  rates: DEFAULT_RATES,
});

const ctx = {
  staffId: 1,
  staffName: 'サンプル 太郎',
  staffEmail: 'staff@example.com',
  department: DEFAULT_DEPARTMENT,
  month: '2026-06',
  periodLabel: periodLabel('2026-06'),
  dayCount: 14,
  rates: DEFAULT_RATES,
  payroll,
  expenses: JUNE_2026_EXPENSES,
};

const docs = ['timesheet', 'transport', 'allowances', 'invoice', 'payslip'].map((t) =>
  renderDocumentHtml(t, ctx),
);
// Strip each doc's <html> wrapper and stack the .page divs into one preview page.
const bodies = docs
  .map((html) => {
    const m = html.match(/<div class="page">([\s\S]*)<\/div><\/body>/);
    return m ? m[1] : html;
  })
  .join('<hr style="margin:32px 0;border:none;border-top:2px dashed #ccc">');

const shell = docs[0].replace(
  /<div class="page">[\s\S]*<\/div><\/body>/,
  `<div class="page">${bodies}</div></body>`,
);

const out = resolve(here, '../../../', 'asahi-documents-preview.html');
// Fall back to scratchpad-relative path within repo if the above is odd.
const target = process.env.PREVIEW_OUT || resolve(here, '..', 'asahi-documents-preview.html');
writeFileSync(target, shell, 'utf8');
console.log(`Wrote preview → ${target}`);
console.log(
  `Figures: salary=${payroll.salaryYen} tax=${payroll.taxYen} transport=${payroll.transportYen} gross=${payroll.grossYen} net=${payroll.netYen}`,
);
