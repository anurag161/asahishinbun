import type { CostBucket, ExpenseCategory, PayrollResult } from '@asahi/shared';
import { BUCKET_LABEL } from '@asahi/shared';
import type { DocumentContext, DocumentType } from './context';
import { DOCUMENT_TITLE } from './context';
import {
  clock,
  dateLabel,
  decimalHours,
  esc,
  monthLabel,
  num,
  timeOfDay,
  yen,
} from './format';

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
  /* 勤務表: 17 columns (two 8-column blocks + 備考) must fit A4 portrait, as on the paper form. */
  table.timesheet { table-layout: fixed; font-size: 9px; }
  table.timesheet td { padding: 2px 1px; text-align: center; white-space: nowrap; }
  table.timesheet th { padding: 2px 1px; font-size: 8.5px; line-height: 1.25; }
  table.timesheet td.num { text-align: center; }
  table.timesheet tbody tr { height: 15px; }
  table.timesheet thead tr:first-child th { font-size: 11px; letter-spacing: 1px; }
  table.summary { width: auto; min-width: 60%; }
  table.summary td { padding: 4px 10px; }
  /* 別紙 (交通費 / 出張日当ほか): amounts are printed with a trailing 円 as on the form. */
  table.fares .fare { display: flex; justify-content: flex-end; gap: 10px; }
  table.fares .unit { color: #444; }
  table.fares td.arrow { width: 26px; color: #444; }
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
/**
 * The paper 勤務表 is one grid split into two blocks side by side — 大会経費（直接費）
 * on the left, 編集費（間接費）on the right — each with the same eight columns, plus a
 * shared 備考 column at the far right. Rows in the two blocks are independent: day 3
 * of the direct block does not line up with day 3 of the indirect block.
 */
const TIMESHEET_COLUMNS = [
  '日付',
  '始業時刻',
  '終業時刻',
  '休憩時間',
  '実働時間<br>（除休憩）',
  '時間外<br>勤務時間',
  '夜勤',
  '弁当代<br>有無',
] as const;

interface BucketBlock {
  bucket: CostBucket;
  days: PayrollResult['days'];
  workedMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  dayCount: number;
}

function bucketBlock(payroll: PayrollResult, bucket: CostBucket): BucketBlock {
  const days = payroll.days.filter((d) => d.bucket === bucket);
  const sum = (f: (d: PayrollResult['days'][number]) => number) =>
    days.reduce((s, d) => s + f(d), 0);
  return {
    bucket,
    days,
    workedMinutes: sum((d) => d.workedMinutes),
    overtimeMinutes: sum((d) => d.overtimeMinutes),
    nightMinutes: sum((d) => d.nightMinutes),
    dayCount: days.length,
  };
}

/** The eight cells of one day inside one block (blank cells when the block has no such row). */
function dayCells(day: PayrollResult['days'][number] | undefined): string {
  if (!day) return '<td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>';
  return `<td class="center">${dateLabel(day.date)}</td>
    <td class="num">${timeOfDay(day.startMinutes)}</td>
    <td class="num">${timeOfDay(day.endMinutes)}</td>
    <td class="num">${day.breakMinutes ? clock(day.breakMinutes) : ''}</td>
    <td class="num">${clock(day.workedMinutes)}</td>
    <td class="num">${day.overtimeMinutes ? clock(day.overtimeMinutes) : ''}</td>
    <td class="num">${day.nightMinutes ? clock(day.nightMinutes) : ''}</td>
    <td class="center">${day.lunchProvided ? '○' : '×'}</td>`;
}

function totalCells(block: BucketBlock): string {
  const label = block.bucket === 'daikai' ? '直接費' : '間接費';
  // An unused block stays blank on the paper form rather than printing 0:00.
  return `<td class="center" colspan="4">${label}　合　計</td>
    <td class="num">${block.dayCount ? clock(block.workedMinutes) : ''}</td>
    <td class="num">${block.overtimeMinutes ? clock(block.overtimeMinutes) : ''}</td>
    <td class="num">${block.nightMinutes ? clock(block.nightMinutes) : ''}</td>
    <td></td>`;
}

function timesheetGrid(payroll: PayrollResult): string {
  const left = bucketBlock(payroll, 'daikai');
  const right = bucketBlock(payroll, 'henshu');
  const rowCount = Math.max(left.days.length, right.days.length);

  const rows =
    rowCount === 0
      ? `<tr><td colspan="17" class="empty">該当なし</td></tr>`
      : Array.from({ length: rowCount }, (_, i) => {
          const noteCell = i === 0 ? `<td rowspan="${rowCount}"></td>` : '';
          return `<tr>${dayCells(left.days[i])}${dayCells(right.days[i])}${noteCell}</tr>`;
        }).join('');

  const headCells = TIMESHEET_COLUMNS.map((c) => `<th>${c}</th>`).join('');
  // Column widths as a share of the sheet: each block is 47.5%, 備考 takes the last 5%.
  const blockCols = [9.5, 5.7, 5.7, 5.2, 7.1, 5.7, 4.3, 4.3]
    .map((w) => `<col style="width:${w}%">`)
    .join('');

  return `<table class="grid timesheet">
    <colgroup>${blockCols}${blockCols}<col style="width:5%"></colgroup>
    <thead>
      <tr>
        <th colspan="8">${BUCKET_LABEL.daikai}</th>
        <th colspan="8">${BUCKET_LABEL.henshu}</th>
        <th rowspan="2">備　考</th>
      </tr>
      <tr>${headCells}${headCells}</tr>
    </thead>
    <tbody>${rows}
      <tr class="total">${totalCells(left)}${totalCells(right)}<td></td></tr>
    </tbody>
  </table>`;
}

/** 日数 / 時給換算用勤務時間 — the boxes printed under each block on the paper form. */
function timesheetFooter(ctx: DocumentContext): string {
  const left = bucketBlock(ctx.payroll, 'daikai');
  const right = bucketBlock(ctx.payroll, 'henshu');
  const row = (block: BucketBlock) => {
    const label = block.bucket === 'daikai' ? '直接費' : '間接費';
    return `<tr>
      <td class="center">${label}</td>
      <td>時給換算用勤務時間</td>
      <td class="num">${block.dayCount ? decimalHours(block.workedMinutes) : ''}</td>
      <td class="center">日数</td>
      <td class="num">${block.dayCount ? `${block.dayCount}日` : ''}</td>
    </tr>`;
  };

  return `<table class="grid summary"><tbody>
    ${row(left)}
    ${row(right)}
    <tr class="grand">
      <td class="center" colspan="2">総合計（実働）</td>
      <td class="num">${clock(ctx.payroll.workedMinutesTotal)}</td>
      <td class="center">日数</td>
      <td class="num">${ctx.dayCount}日</td>
    </tr>
  </tbody></table>`;
}

export function buildTimesheetHtml(ctx: DocumentContext): string {
  const body = `
    <h1>${DOCUMENT_TITLE.timesheet}</h1>
    <p class="subtitle">${monthLabel(ctx.month)}　高校野球　※弁当代の支給は大会期間中かつ1日の労働時間が6時間を超える場合に限る</p>
    ${metaTable(ctx)}
    ${timesheetGrid(ctx.payroll)}
    ${timesheetFooter(ctx)}
    <p class="footer">朝日新聞総合サービス株式会社</p>`;
  return htmlShell(`${DOCUMENT_TITLE.timesheet} ${monthLabel(ctx.month)}`, body);
}

// --- 交通費 (別紙) ---
/** '2026-06-03' → '6月3日' — the date form used on the 別紙 sheets. */
function jaDate(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number);
  return `${m}月${d}日`;
}

interface Leg {
  from: string;
  to: string;
  mode: string;
}

/**
 * Auto transport lines are described as `円山 → 大阪（バス、電車）` (transportService),
 * which the sheet splits into 区間明細（片道）and 交通手段. A manual line with free-text
 * description falls back to putting the whole text in the 区間 column.
 */
function parseLeg(description: string | undefined): Leg {
  const text = (description ?? '').trim();
  const match = /^(.+?)\s*(?:→|⇒|->)\s*([^（(]+?)\s*(?:[（(](.+?)[）)])?$/.exec(text);
  if (!match) return { from: text, to: '', mode: '' };
  return { from: match[1]!.trim(), to: match[2]!.trim(), mode: (match[3] ?? '').trim() };
}

/** One fare cell: the amount right-aligned against a 円 flush to the cell edge, as on the form. */
function fareCell(amountYen: number | null): string {
  return `<td class="num"><span class="fare">
    <span>${amountYen ? num(amountYen) : ''}</span><span class="unit">円</span>
  </span></td>`;
}

/** Cell pair for the 直接費 / 間接費 fare columns — an amount lands in its own bucket. */
function bucketAmountCells(bucket: CostBucket, amountYen: number): string {
  return `${fareCell(bucket === 'daikai' ? amountYen : null)}${fareCell(
    bucket === 'henshu' ? amountYen : null,
  )}`;
}

function bucketTotalCells(lines: { bucket: CostBucket; amountYen: number }[]): string {
  const total = (b: CostBucket) =>
    lines.filter((l) => l.bucket === b).reduce((s, l) => s + l.amountYen, 0);
  return `${fareCell(total('daikai') || null)}${fareCell(total('henshu') || null)}`;
}

export function buildTransportHtml(ctx: DocumentContext): string {
  const lines = ctx.expenses
    .filter((e) => e.category === 'transport')
    .sort((a, b) => a.date.localeCompare(b.date));

  const rows = lines.length
    ? lines
        .map((l) => {
          const leg = parseLeg(l.description);
          return `<tr>
            <td class="center">${esc(jaDate(l.date))}</td>
            <td class="center">${esc(leg.from)}</td>
            <td class="center arrow">⇒</td>
            <td class="center">${esc(leg.to)}</td>
            <td class="center">${esc(leg.mode)}</td>
            ${bucketAmountCells(l.bucket, l.amountYen)}
          </tr>`;
        })
        .join('')
    : `<tr><td colspan="7" class="empty">該当なし</td></tr>`;

  const body = `
    <h1>${monthLabel(ctx.month)}　${DOCUMENT_TITLE.transport}</h1>
    <p class="subtitle">交通費（別紙）　※片道ごとに1行（往復は2行）</p>
    ${metaTable(ctx)}
    <table class="grid fares">
      <thead>
        <tr>
          <th rowspan="2">日付</th>
          <th rowspan="2" colspan="3">区間明細（片道）</th>
          <th rowspan="2">交通手段<br>（電車・バス・私有車）</th>
          <th>${BUCKET_LABEL.daikai}</th>
          <th>${BUCKET_LABEL.henshu}</th>
        </tr>
        <tr><th>料　金</th><th>料　金</th></tr>
      </thead>
      <tbody>${rows}
        <tr class="total">
          <td class="center" colspan="5">合　計</td>
          ${bucketTotalCells(lines)}
        </tr>
      </tbody>
    </table>
    <p class="footer">朝日新聞総合サービス株式会社</p>`;
  return htmlShell(`${DOCUMENT_TITLE.transport} ${monthLabel(ctx.month)}`, body);
}

// --- 出張日当 / 私有携帯電話使用料 / その他 (別紙) ---
const ALLOWANCE_SECTIONS: { title: string; categories: ExpenseCategory[] }[] = [
  { title: '出張日当', categories: ['perdiem'] },
  { title: '私有携帯電話使用料', categories: ['phone'] },
  { title: 'その他（宿泊実費etc.）', categories: ['lodging', 'other'] },
];

function allowanceSection(
  ctx: DocumentContext,
  section: { title: string; categories: ExpenseCategory[] },
): string {
  const lines = ctx.expenses
    .filter((e) => section.categories.includes(e.category))
    .sort((a, b) => a.date.localeCompare(b.date));

  const rows = lines.length
    ? lines
        .map(
          (l) => `<tr>
            <td class="center">${esc(jaDate(l.date))}</td>
            <td>${esc(l.description ?? '')}</td>
            ${bucketAmountCells(l.bucket, l.amountYen)}
          </tr>`,
        )
        .join('')
    : `<tr><td colspan="4" class="empty">該当なし</td></tr>`;

  return `<div class="section-title">◆${section.title}</div>
    <table class="grid fares">
      <thead>
        <tr>
          <th rowspan="2" style="width:16%">日付</th>
          <th rowspan="2">摘　要</th>
          <th>${BUCKET_LABEL.daikai}</th>
          <th>${BUCKET_LABEL.henshu}</th>
        </tr>
        <tr><th style="width:20%">料　金</th><th style="width:20%">料　金</th></tr>
      </thead>
      <tbody>${rows}
        <tr class="total">
          <td class="center" colspan="2">合　計</td>
          ${bucketTotalCells(lines)}
        </tr>
      </tbody>
    </table>`;
}

export function buildAllowancesHtml(ctx: DocumentContext): string {
  const body = `
    <h1>${monthLabel(ctx.month)}</h1>
    <p class="subtitle">出張日当・私有携帯電話使用料・その他（別紙）</p>
    ${metaTable(ctx)}
    ${ALLOWANCE_SECTIONS.map((s) => allowanceSection(ctx, s)).join('')}
    <p class="footer">朝日新聞総合サービス株式会社</p>`;
  return htmlShell(`${DOCUMENT_TITLE.allowances} ${monthLabel(ctx.month)}`, body);
}

// --- 請求明細書 (invoice) ---
interface InvoiceAgg {
  baseWage: number;
  otUnderWage: number;
  otOverWage: number;
  otUnderMinutes: number;
  otOverMinutes: number;
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
    otUnderWage: sum((d) => d.overtimeUnderYen),
    otOverWage: sum((d) => d.overtimeOverYen),
    otUnderMinutes: sum((d) => d.overtimeUnderMinutes),
    otOverMinutes: sum((d) => d.overtimeOverMinutes),
    nightWage: sum((d) => d.nightWageYen),
    lunch: sum((d) => d.lunchYen),
    phone: e.phone,
    transport: e.transport,
    perdiem: e.perdiem,
    lodging: e.lodging,
    other: e.other,
  };
}

/** 時間外 note: unit price, plus the hours it was charged on once there are any. */
function otNote(unitYen: number, minutes: number): string {
  return `@${num(unitYen)}円${minutes ? ` × ${clock(minutes)}（8時間超）` : ''}`;
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
      ${line('時間外（60h以下）', a.otUnderWage, otNote(ctx.rates.overtimeUnder60Yen, a.otUnderMinutes))}
      ${line('時間外（60h超）', a.otOverWage, otNote(ctx.rates.overtimeOver60Yen, a.otOverMinutes))}
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

/**
 * 暫定 notice. The 丙 日額表 is transcribed to ¥14,800/day; a day above that (a long
 * overtime shift will do it) gets an extrapolated 税額. The document has to say so —
 * printing an estimate that reads like a settled figure is the failure mode.
 */
function provisionalTaxNote(p: PayrollResult): string {
  if (!p.taxProvisional) return '';
  const dates = p.provisionalTaxDays.map(dateLabel).join('、');
  return `<p class="note-provisional" style="margin-top:10px;font-size:11px;color:#8a5a00;
    border:1px solid #e0c07a;background:#fdf6e3;padding:6px 8px;border-radius:4px">
    ※ ${dates} は1日の課税対象額が ¥14,800 を超えるため、所得税は日額表・丙の
    収録範囲外の<strong>暫定計算</strong>です。正式な税額は要確認のうえ確定してください。</p>`;
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
        ${line('所得税', p.taxYen, p.taxProvisional ? '※暫定' : '')}
        <tr class="grand"><td>差引支給額</td><td class="num">${yen(p.netYen)}${
          p.taxProvisional ? '<span style="color:#888"> ※暫定</span>' : ''
        }</td></tr>
      </tbody>
    </table>
    ${provisionalTaxNote(p)}
    <p class="footer">朝日新聞社</p>`;
  return htmlShell(`${DOCUMENT_TITLE.payslip} ${monthLabel(ctx.month)}`, body);
}

export function renderDocumentHtml(type: DocumentType, ctx: DocumentContext): string {
  switch (type) {
    case 'timesheet':
      return buildTimesheetHtml(ctx);
    case 'transport':
      return buildTransportHtml(ctx);
    case 'allowances':
      return buildAllowancesHtml(ctx);
    case 'invoice':
      return buildInvoiceHtml(ctx);
    case 'payslip':
      return buildPayslipHtml(ctx);
  }
}
