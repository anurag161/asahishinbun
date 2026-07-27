// Render the user guides (docs/USERGUIDE.ja.md / .en.md) to styled A4 PDFs, plus
// a combined bilingual PDF. Uses the server's bundled Chromium + Noto Sans JP.
//   node scripts/build-guide-pdf.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const require = createRequire(resolve(root, 'server') + '/');
const puppeteer = require('puppeteer');

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Inline: **bold**, `code`, [text](url) → text (links are useless in print).
const inline = (s) =>
  esc(s)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

/** Convert the small Markdown subset used by the guides into HTML. */
function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;
  const flushList = (tag, items) =>
    out.push(`<${tag}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${tag}>`);

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*$/.test(line)) { i++; continue; }

    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^#+/)[0].length;
      out.push(`<h${level}>${inline(line.replace(/^#+\s/, ''))}</h${level}>`);
      i++; continue;
    }

    if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    // Table: header row, separator row, then body rows.
    if (/^\|.*\|\s*$/.test(line) && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` +
          `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
      );
      continue;
    }

    if (/^\s*\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s/, '')); i++; }
      flushList('ol', items);
      continue;
    }

    if (/^\s*[-*]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s/, '')); i++; }
      flushList('ul', items);
      continue;
    }

    // Paragraph (gather until blank line).
    const para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^[#|>-]/.test(lines[i])) { para.push(lines[i]); i++; }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

/** Split a guide into its preamble (before the first ##) and its ## sections. */
function splitSections(md) {
  const lines = md.split(/\r?\n/);
  const preamble = [];
  const sections = [];
  let cur = null;
  for (const l of lines) {
    if (/^##\s/.test(l)) { cur = [l]; sections.push(cur); }
    else if (cur) cur.push(l);
    else preamble.push(l);
  }
  return { preamble: preamble.join('\n'), sections: sections.map((s) => s.join('\n')) };
}

/**
 * Interleave the two guides so each section's English sits directly under the
 * Japanese, rather than the whole English guide following the whole Japanese one.
 */
function bilingualBody(jaMd, enMd) {
  const ja = splitSections(jaMd);
  const en = splitSections(enMd);
  const parts = [
    mdToHtml(ja.preamble),
    `<div class="en">${mdToHtml(en.preamble)}</div>`,
  ];
  const n = Math.max(ja.sections.length, en.sections.length);
  for (let i = 0; i < n; i++) {
    parts.push('<section>');
    if (ja.sections[i]) parts.push(mdToHtml(ja.sections[i]));
    if (en.sections[i]) parts.push(`<div class="en">${mdToHtml(en.sections[i])}</div>`);
    parts.push('</section>');
  }
  return parts.join('\n');
}

const fontB64 = readFileSync(resolve(root, 'server/assets/fonts/NotoSansJP.ttf')).toString('base64');

function shell(title, bodyHtml) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @font-face { font-family: 'Noto Sans JP'; src: url(data:font/ttf;base64,${fontB64}) format('truetype'); }
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Noto Sans JP', sans-serif; color: #1a1a1a; font-size: 10.5pt; line-height: 1.6; }
  h1 { font-size: 20pt; border-bottom: 3px solid #1f3a93; padding-bottom: 6px; margin: 0 0 14px; }
  h2 { font-size: 14pt; color: #1f3a93; margin: 22px 0 8px; border-left: 5px solid #1f3a93; padding-left: 8px; }
  h3 { font-size: 12pt; margin: 16px 0 6px; }
  p { margin: 6px 0; }
  hr { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 9.5pt; }
  th, td { border: 1px solid #bbb; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #eef1f8; font-weight: 700; }
  ul, ol { margin: 6px 0; padding-left: 22px; }
  li { margin: 3px 0; }
  code { background: #f0f2f5; padding: 1px 5px; border-radius: 3px; font-size: 9.5pt; }
  strong { color: #10214f; }
  .lang-badge { display: inline-block; background: #1f3a93; color: #fff; font-size: 9pt;
    padding: 2px 10px; border-radius: 10px; margin-bottom: 10px; }
  .pagebreak { page-break-before: always; }
  h2, h3 { page-break-after: avoid; }
  /* Bilingual: the English translation under each Japanese section. */
  section { margin-bottom: 4px; }
  .en { border-left: 3px solid #b9c4e0; padding-left: 12px; margin: 4px 0 10px;
    color: #33415c; }
  .en h1 { font-size: 14pt; color: #33415c; border: none; margin: 4px 0 8px; }
  .en h2 { font-size: 11.5pt; color: #33415c; border-left: none; padding-left: 0;
    margin: 6px 0 6px; }
  .en h3 { font-size: 10.5pt; color: #33415c; }
  .en th { background: #f2f4f9; }
  .en strong { color: #26314d; }
</style></head><body>${bodyHtml}</body></html>`;
}

const ja = readFileSync(resolve(root, 'docs/USERGUIDE.ja.md'), 'utf8');
const en = readFileSync(resolve(root, 'docs/USERGUIDE.en.md'), 'utf8');
const jaHtml = mdToHtml(ja);
const enHtml = mdToHtml(en);

const docs = [
  { file: 'USERGUIDE.ja.pdf', title: '操作マニュアル（日本語）', body: jaHtml },
  { file: 'USERGUIDE.en.pdf', title: 'User Guide (English)', body: enHtml },
  {
    file: 'USERGUIDE.bilingual.pdf',
    title: '操作マニュアル / User Guide',
    body: bilingualBody(ja, en),
  },
];

const browser = await puppeteer.launch();
try {
  for (const d of docs) {
    const page = await browser.newPage();
    await page.setContent(shell(d.title, d.body), { waitUntil: 'load' });
    if (process.env.PREVIEW_PNG) {
      await page.setViewport({ width: 820, height: 1160, deviceScaleFactor: 1 });
      await page.screenshot({ path: resolve(process.env.PREVIEW_PNG, d.file + '.png') });
    }
    await page.pdf({
      path: resolve(root, 'docs', d.file),
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        '<div style="width:100%;font-size:8pt;color:#888;text-align:center;">' +
        '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: '18mm', bottom: '16mm', left: '16mm', right: '16mm' },
    });
    await page.close();
    console.log('wrote docs/' + d.file);
  }
} finally {
  await browser.close();
}
