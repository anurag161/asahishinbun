import type { CostBucket, PayrollResult } from '@asahi/shared';
import { BUCKET_LABEL } from '@asahi/shared';
import type { DocumentContext, DocumentType } from './context';
import { DOCUMENT_TITLE } from './context';
import { clock, dateLabel, esc, monthLabel, num, yen } from './format';

const CSS = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic",
      "Meiryo", "MS PGothic", sans-serif;
    color: #111; font-size: 12px; line-height: 1.5;
  }
  .page { width: 190mm; margin: 0 auto; padding: 10mm; }
  h1 { font-size: 18px; text-align: center; margin: 0 0 4px; letter-spacing: 2px; }
  .subtitle { text-align: center; color: #555; margin: 0 0 14px; font-size: 12px; }
  .meta { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  .meta td { border: 1px solid #999; padding: 4px 8px; }
  .meta .label { background: #f0f0f0; width: 90px; white-space: nowrap; font-weight: 600; }
  table.grid { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  table.grid th, table.grid td { border: 1px solid #999; padding: 4px 8px; }
  table.grid th { background: #f0f0f0; font-weight: 600; text-align: center; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.center { text-align: center; }
  tr.total td { background: #f7f7f7; font-weight: 700; }
  tr.grand td { background: #eef3fb; font-weight: 800; font-size: 13px; }
  .section-title { font-weight: 700; margin: 14px 0 6px; padding-left: 6px;
    border-left: 4px solid #3366aa; }
  .empty { color: #999; font-style: italic; padding: 8px; }
  .footer { margin-top: 16px; color: #666; font-size: 11px; text-align: right; }
  @page { size: A4; margin: 10mm; }
  @media print { .page { width: auto; margin: 0; padding: 0; } }
`;

export function htmlShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head><body><div class="page">${body}</div></body></html>`;
}

function metaTable(ctx: DocumentContext): string {
  return `<table class="meta">
    <tr><td class="label">所属</td><td>${esc(ctx.department)}</td>
        <td class="label">氏名</td><td>${esc(ctx.staffName)}</td></tr>
    <tr><td class="label">期間</td><td colspan="3">${esc(ctx.periodLabel)}　（課税額計算用の日数：${ctx.dayCount}日）</td></tr>
  </table>`;
}

// --- 勤務表 (timesheet) ---
function bucketTable(payroll: PayrollResult, bucket: CostBucket): string {
  const days = payroll.days.filter((d) => d.bucket === bucket);
  const subtotalMin = days.reduce((s, d) => s + d.workedMinutes, 0);

  const rows = days.length
    ? days
        .map(
          (d) => `<tr>
        <td class="center">${dateLabel(d.date)}</td>
        <td class="num">${clock(d.workedMinutes)}</td>
        <td class="num">${d.overtimeWageYen ? clock(0) : '—'}</td>
        <td class="num">${d.nightWageYen ? '有' : '—'}</td>
        <td class="num">${d.lunchYen ? '有' : '—'}</td>
        <td class="num">${yen(d.dailyWageYen)}</td>
      </tr>`,
        )
        .join('')
    : `<tr><td colspan="6" class="empty">該当なし</td></tr>`;

  return `<div class="section-title">${BUCKET_LABEL[bucket]}</div>
    <table class="grid">
      <thead><tr>
        <th>日付</th><th>実働時間</th><th>時間外</th><th>深夜</th><th>弁当代</th><th>日額</th>
      </tr></thead>
      <tbody>${rows}
        <tr class="total"><td class="center">合計</td>
          <td class="num">${clock(subtotalMin)}</td>
          <td colspan="4"></td></tr>
      </tbody>
    </table>`;
}

export function buildTimesheetHtml(ctx: DocumentContext): string {
  const body = `
    <h1>${DOCUMENT_TITLE.timesheet}</h1>
    <p class="subtitle">${monthLabel(ctx.month)}　高校野球　※弁当代の支給は大会期間中かつ1日の労働時間が6時間を超える場合に限る</p>
    ${metaTable(ctx)}
    ${bucketTable(ctx.payroll, 'daikai')}
    ${bucketTable(ctx.payroll, 'henshu')}
    <table class="grid"><tbody>
      <tr class="grand"><td class="center">総合計（実働）</td>
        <td class="num">${clock(ctx.payroll.workedMinutesTotal)}</td>
        <td class="center">日数</td><td class="num">${ctx.dayCount}日</td></tr>
    </tbody></table>
    <p class="footer">朝日新聞総合サービス株式会社</p>`;
  return htmlShell(`${DOCUMENT_TITLE.timesheet} ${monthLabel(ctx.month)}`, body);
}

// --- 請求明細書 (invoice) ---
interface InvoiceAgg {
  baseWage: number;
  otWage: number;
  nightWage: number;
  lunch: number;
  phone: number;
  transport: number;
  perdiem: number;
  lodging: number;
  other: number;
}

function invoiceAgg(payroll: PayrollResult): InvoiceAgg {
  const sum = (f: (d: PayrollResult['days'][number]) => number) =>
    payroll.days.reduce((s, d) => s + f(d), 0);
  const e = payroll.expenseByCategory;
  return {
    baseWage: sum((d) => d.baseWageYen),
    otWage: sum((d) => d.overtimeWageYen),
    nightWage: sum((d) => d.nightWageYen),
    lunch: sum((d) => d.lunchYen),
    phone: e.phone,
    transport: e.transport,
    perdiem: e.perdiem,
    lodging: e.lodging,
    other: e.other,
  };
}

function line(label: string, value: number, note = ''): string {
  return `<tr><td>${label}${note ? ` <span style="color:#888">${note}</span>` : ''}</td>
    <td class="num">${yen(value)}</td></tr>`;
}

export function buildInvoiceHtml(ctx: DocumentContext): string {
  const p = ctx.payroll;
  const a = invoiceAgg(p);
  const hours = clock(p.workedMinutesTotal);

  const body = `
    <h1>${DOCUMENT_TITLE.invoice}</h1>
    <p class="subtitle">（高校野球用）</p>
    ${metaTable(ctx)}

    <div class="section-title">給料（課税分）</div>
    <table class="grid"><tbody>
      ${line('時給', a.baseWage, `@${num(ctx.rates.hourlyYen)}円 × ${hours}`)}
      ${line('時間外（60h以下）', a.otWage, `@${num(ctx.rates.overtimeUnder60Yen)}円`)}
      ${line('時間外（60h超）', 0, `@${num(ctx.rates.overtimeOver60Yen)}円`)}
      ${line('深夜割増', a.nightWage, `@${num(ctx.rates.nightYen)}円`)}
      ${line('弁当代（定額）', a.lunch)}
      ${line('私有携帯電話使用料', a.phone)}
      <tr class="total"><td>①給料 合計</td><td class="num">${yen(p.salaryYen)}</td></tr>
    </tbody></table>

    <div class="section-title">交通費・その他（非課税）</div>
    <table class="grid"><tbody>
      ${line('交通費', a.transport)}
      ${line('出張日当', a.perdiem)}
      <tr class="total"><td>②交通費 合計</td><td class="num">${yen(p.transportYen)}</td></tr>
      ${line('その他（宿泊実費 等）', p.otherYen)}
      <tr class="total"><td>③その他 合計</td><td class="num">${yen(p.otherYen)}</td></tr>
    </tbody></table>

    <table class="grid"><tbody>
      <tr class="total"><td>課税分計</td><td class="num">${yen(p.salaryYen)}</td></tr>
      <tr class="grand"><td>請求額合計（①＋②＋③）</td><td class="num">${yen(p.grossYen)}</td></tr>
    </tbody></table>
    <p class="footer">朝日新聞総合サービス株式会社</p>`;
  return htmlShell(`${DOCUMENT_TITLE.invoice} ${monthLabel(ctx.month)}`, body);
}

// --- 給料計算書 (payslip) ---
export function buildPayslipHtml(ctx: DocumentContext): string {
  const p = ctx.payroll;
  const a = invoiceAgg(p);

  const body = `
    <h1>${DOCUMENT_TITLE.payslip}</h1>
    <p class="subtitle">${monthLabel(ctx.month)}分</p>
    ${metaTable(ctx)}
    <table class="grid">
      <thead><tr><th>摘要</th><th class="num">金額</th></tr></thead>
      <tbody>
        ${line('給料', p.salaryYen)}
        ${line('弁当代', a.lunch)}
        ${line('私有携帯電話使用料', a.phone)}
        ${line('交通費', a.transport)}
        ${line('出張日当', a.perdiem)}
        ${line('宿泊実費 等', p.otherYen)}
        <tr class="total"><td>支給額計</td><td class="num">${yen(p.grossYen)}</td></tr>
        ${line('所得税', p.taxYen)}
        <tr class="grand"><td>差引支給額</td><td class="num">${yen(p.netYen)}</td></tr>
      </tbody>
    </table>
    <p class="footer">朝日新聞社</p>`;
  return htmlShell(`${DOCUMENT_TITLE.payslip} ${monthLabel(ctx.month)}`, body);
}

export function renderDocumentHtml(type: DocumentType, ctx: DocumentContext): string {
  switch (type) {
    case 'timesheet':
      return buildTimesheetHtml(ctx);
    case 'invoice':
      return buildInvoiceHtml(ctx);
    case 'payslip':
      return buildPayslipHtml(ctx);
  }
}
