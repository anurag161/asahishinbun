/**
 * HTML → PDF via headless Chromium (Puppeteer), loaded lazily and optionally.
 *
 * Puppeteer is NOT a hard dependency: the fidelity-critical output is the HTML,
 * which every browser can "Save as PDF" for free. Server-side PDF (for the email
 * attachment and the download endpoint) is enabled by installing puppeteer:
 *
 *     npm i puppeteer -w server        # downloads a Chromium build
 *
 * When it isn't installed, `available()` returns false and callers fall back to
 * HTML. This keeps the base build light and the free-tier deploy simple.
 */

export interface PdfRenderer {
  available(): Promise<boolean>;
  render(html: string): Promise<Buffer>;
}

let cachedModule: any | null = null;
let triedLoad = false;

async function loadPuppeteer(): Promise<any | null> {
  if (triedLoad) return cachedModule;
  triedLoad = true;
  try {
    // Indirect specifier so bundlers/tsc don't hard-require it.
    const mod = await import('puppeteer' as string);
    cachedModule = mod.default ?? mod;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

const LAUNCH_ARGS = ['--no-sandbox', '--disable-setuid-sandbox'];

/**
 * Whether Chromium actually starts here — not merely whether the package is
 * installed. On a host without Chromium's shared libraries (Render's Node
 * runtime, most slim containers) the import succeeds and the launch does not,
 * so checking the import alone reports PDF as working and then throws mid-request.
 *
 * Probed once and cached; the result cannot change without a restart.
 */
let launchProbe: Promise<boolean> | null = null;

async function canLaunch(): Promise<boolean> {
  const puppeteer = await loadPuppeteer();
  if (!puppeteer) return false;

  let browser: { close(): Promise<void> } | undefined;
  try {
    browser = await puppeteer.launch({ headless: true, args: LAUNCH_ARGS });
    return true;
  } catch (err) {
    console.warn(
      `  • PDF: Chromium is installed but failed to launch — ${(err as Error).message.split('\n')[0]}`,
    );
    return false;
  } finally {
    await browser?.close().catch(() => {});
  }
}

export const puppeteerRenderer: PdfRenderer = {
  async available() {
    launchProbe ??= canLaunch();
    return launchProbe;
  },

  async render(html: string): Promise<Buffer> {
    const puppeteer = await loadPuppeteer();
    if (!puppeteer) {
      throw new Error('PDF rendering unavailable: puppeteer is not installed.');
    }
    const browser = await puppeteer.launch({ headless: true, args: LAUNCH_ARGS });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  },
};
