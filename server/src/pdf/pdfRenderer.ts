/**
 * HTML → PDF via headless Chromium, loaded lazily and optionally.
 *
 * Chromium is NOT a hard requirement: the fidelity-critical output is the HTML,
 * which every browser can "Save as PDF" for free. When no browser can be
 * started, `available()` returns false and callers fall back to HTML.
 *
 * Two ways a browser is found, tried in order:
 *
 *   1. @sparticuz/chromium — a Chromium build that carries its own shared
 *      libraries. This is what makes PDF work on slim Linux hosts (Render's
 *      Node runtime, most containers), where the Chromium that puppeteer
 *      downloads imports fine but cannot launch: no libnss3, no libgbm.
 *      It ships a Linux x64 binary only, so it is skipped elsewhere.
 *   2. puppeteer's own bundled Chromium — the local development path (macOS,
 *      Windows, or a Linux box with the libraries already installed).
 */

export interface PdfRenderer {
  available(): Promise<boolean>;
  render(html: string): Promise<Buffer>;
}

type LaunchOptions = Record<string, unknown>;

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

const BASE_ARGS = ['--no-sandbox', '--disable-setuid-sandbox'];

/**
 * Point Chromium's fontconfig at the Noto Sans JP shipped with the server.
 *
 * Neither @sparticuz/chromium nor a slim Linux image carries a CJK font, so
 * without this every 漢字 and かな in the 勤務表 / 請求明細書 / 給料計算書 renders
 * as a tofu box while the ASCII figures come out fine — a payslip nobody can
 * read, which is worse than no attachment. So a missing font is loud, not silent.
 *
 * Done through fontconfig rather than @sparticuz/chromium's own font helper:
 * that helper was removed in v149, and FONTCONFIG_PATH is Chromium's own
 * mechanism, so this keeps working across their releases. The font directory is
 * referenced in place — no copying 9MB per boot.
 *
 * The font is the variable weight axis, so bold headings render properly rather
 * than being synthesised, and the templates already ask for "Noto Sans JP"
 * first, so this satisfies their existing stack rather than changing it.
 *
 * Linux only: macOS and Windows resolve the family through the OS already.
 */
let fontsConfigured = false;

async function configureLinuxFonts(): Promise<void> {
  if (fontsConfigured) return;
  fontsConfigured = true;

  const [{ join }, fs, os] = await Promise.all([
    import('node:path'),
    import('node:fs'),
    import('node:os'),
  ]);
  // dist/pdf → server/assets/fonts (assets sit outside src, so tsc leaves them).
  const fontDir = join(__dirname, '..', '..', 'assets', 'fonts');
  if (!fs.existsSync(join(fontDir, 'NotoSansJP.ttf'))) {
    console.warn(`  • PDF: no Japanese font in ${fontDir} — kanji would render as boxes`);
    return;
  }

  try {
    const confDir = join(os.tmpdir(), 'asahi-fontconfig');
    fs.mkdirSync(confDir, { recursive: true });
    fs.writeFileSync(
      join(confDir, 'fonts.conf'),
      `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontDir}</dir>
  <cachedir>${join(os.tmpdir(), 'asahi-fontconfig-cache')}</cachedir>
</fontconfig>
`,
    );
    process.env.FONTCONFIG_PATH = confDir;
  } catch (err) {
    console.warn(`  • PDF: could not configure fonts — ${(err as Error).message}`);
  }
}

/**
 * Candidate launch configurations, best-supported first. Each is a thunk so the
 * expensive part (sparticuz unpacks its binary to /tmp on first call) only runs
 * if that candidate is actually reached.
 */
async function launchCandidates(): Promise<{ label: string; options: () => Promise<LaunchOptions> }[]> {
  const candidates: { label: string; options: () => Promise<LaunchOptions> }[] = [];

  // Linux only — the package ships no macOS/Windows binary, and asking for its
  // executablePath there yields something that cannot run.
  if (process.platform === 'linux') {
    candidates.push({
      label: '@sparticuz/chromium',
      options: async () => {
        const mod: any = await import('@sparticuz/chromium' as string);
        const chromium = mod.default ?? mod;
        // Rendering an A4 document needs no GPU; off keeps it inside the memory
        // a free-tier instance actually has.
        if ('setGraphicsMode' in chromium) chromium.setGraphicsMode = false;
        return {
          args: [...chromium.args, ...BASE_ARGS],
          executablePath: await chromium.executablePath(),
          headless: true,
        };
      },
    });
  }

  candidates.push({
    label: 'puppeteer bundled Chromium',
    options: async () => ({ headless: true, args: BASE_ARGS }),
  });

  return candidates;
}

/**
 * Whether Chromium actually starts here — not merely whether a package is
 * installed. Checking the import alone reports PDF as working and then throws
 * mid-request, which is how a failed launch used to take a whole email down.
 *
 * Probed once and cached, along with whichever candidate won, so `render` does
 * not re-discover it per request. The answer cannot change without a restart.
 */
let resolved: Promise<{ label: string; options: LaunchOptions } | null> | null = null;

async function resolveBrowser(): Promise<{ label: string; options: LaunchOptions } | null> {
  const puppeteer = await loadPuppeteer();
  if (!puppeteer) return null;

  // Applies to whichever candidate wins — a bundled Chromium on a slim Linux
  // host is just as fontless as sparticuz's.
  if (process.platform === 'linux') await configureLinuxFonts();

  for (const candidate of await launchCandidates()) {
    let browser: { close(): Promise<void> } | undefined;
    try {
      const options = await candidate.options();
      browser = await puppeteer.launch(options);
      return { label: candidate.label, options };
    } catch (err) {
      const reason = (err as Error).message.split('\n')[0];
      console.warn(`  • PDF: ${candidate.label} unavailable — ${reason}`);
    } finally {
      await browser?.close().catch(() => {});
    }
  }
  return null;
}

export const puppeteerRenderer: PdfRenderer = {
  async available() {
    resolved ??= resolveBrowser();
    return (await resolved) !== null;
  },

  async render(html: string): Promise<Buffer> {
    resolved ??= resolveBrowser();
    const browserSetup = await resolved;
    if (!browserSetup) {
      throw new Error('PDF rendering unavailable: no Chromium could be started.');
    }
    const puppeteer = await loadPuppeteer();

    const browser = await puppeteer.launch(browserSetup.options);
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

  /** Which browser won the probe, for the startup banner. null until probed. */
  async describe(): Promise<string | null> {
    resolved ??= resolveBrowser();
    return (await resolved)?.label ?? null;
  },
} as PdfRenderer & { describe(): Promise<string | null> };
