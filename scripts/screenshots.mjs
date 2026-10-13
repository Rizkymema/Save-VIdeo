// Ambil screenshot halaman utama di HP & desktop (tema gelap/terang) + cek error konsol & scroll horizontal.
// Pakai: node scripts/screenshots.mjs [baseUrl] [outDir]
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const outDir = process.argv[3] ?? "test-results/screenshots";
const pages = (process.env.PAGES ?? "/,/en,/tiktok,/terms").split(",");
const themes = (process.env.THEMES ?? "dark,light").split(",");
const viewports = [
  { name: "mobile", width: 375, height: 812, isMobile: true, hasTouch: true },
  { name: "desktop", width: 1440, height: 900 },
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
let problems = 0;

for (const vp of viewports) {
  for (const theme of themes) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile ?? false,
      hasTouch: vp.hasTouch ?? false,
      deviceScaleFactor: 1,
    });
    await context.addInitScript((t) => {
      try {
        localStorage.setItem("savelink:theme", t);
      } catch {}
    }, theme);
    const page = await context.newPage();
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") errors.push(`${msg.type()}: ${msg.text()}`);
    });
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

    for (const p of pages) {
      await page.goto(base + p, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const file = path.join(outDir, `${vp.name}-${theme}${p === "/" ? "-home" : p.replaceAll("/", "-")}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const status = overflow > 0 ? `⚠ overflow ${overflow}px` : "ok";
      if (overflow > 0) problems++;
      console.log(`${vp.name.padEnd(7)} ${theme.padEnd(5)} ${p.padEnd(8)} ${status} → ${file}`);
    }
    if (errors.length) {
      problems += errors.length;
      console.log(`  console (${vp.name}/${theme}):\n   - ${[...new Set(errors)].join("\n   - ")}`);
    }
    await context.close();
  }
}
await browser.close();
console.log(problems ? `\n${problems} masalah ditemukan` : "\n✓ tanpa error konsol & tanpa scroll horizontal");
