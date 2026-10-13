import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { JOB_ID, VIDEO_INFO, YT_URL, mockInfo, mockJob, submitUrl } from "./fixtures";

test.describe("halaman utama", () => {
  test("tampil tanpa error konsol & tanpa scroll horizontal", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Download video");
    await expect(page.getByRole("button", { name: /Ambil Video/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test("lolos audit aksesibilitas otomatis (WCAG 2.1 AA)", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node`)).toEqual([]);
  });
});

test.describe("alur download", () => {
  test("validasi input di sisi client", async ({ page }) => {
    await page.goto("/");
    await submitUrl(page, "halo bukan link");
    await expect(page.locator("#video-url-helper")).toContainText("bukan link yang valid");
    await expect(page.getByLabel("Link video")).toHaveAttribute("aria-invalid", "true");
  });

  test("tempel link → skeleton → preview & pilihan kualitas", async ({ page }) => {
    await mockInfo(page, { delayMs: 600 });
    await page.goto("/");
    await submitUrl(page);
    await expect(page.getByRole("status").filter({ hasText: "Mengambil info video" })).toBeAttached();
    await expect(page.getByRole("heading", { name: VIDEO_INFO.title })).toBeVisible();
    await expect(page.getByRole("button", { name: /Download Terbaik 1080p \(MP4\)/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Download 4K \(MP4\)/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Download Audio saja \(MP3\)/ })).toBeVisible();
    await expect(page.getByText("VP9 · mungkin tidak terputar di galeri iPhone").first()).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node`)).toEqual([]);
    await page.screenshot({ path: `test-results/screenshots/state-info-${test.info().project.name}.png`, fullPage: true });
  });

  test("progress lalu batal", async ({ page }) => {
    await mockInfo(page);
    await mockJob(page);
    await page.goto("/");
    await submitUrl(page);
    await page.getByRole("button", { name: /Download Terbaik 1080p/ }).click();
    await expect(page.getByText("Mengunduh video")).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
    await expect(page.getByText(/sisa 0:23/)).toBeVisible();
    await page.screenshot({ path: `test-results/screenshots/state-progress-${test.info().project.name}.png`, fullPage: true });

    const cancel = page.waitForRequest((r) => r.url().endsWith(`/api/jobs/${JOB_ID}`) && r.method() === "DELETE");
    await page.getByRole("button", { name: "Batalkan" }).click();
    await cancel;
    await expect(page.getByText("Unduhan dibatalkan.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Download Terbaik 1080p/ })).toBeEnabled();
  });

  test("selesai → file terunduh otomatis & masuk riwayat", async ({ page }) => {
    await mockInfo(page);
    await mockJob(page, { finish: true });
    await page.goto("/");
    await submitUrl(page);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download Terbaik 1080p/ }).click();
    // Unduhan otomatis dipicu ke URL file job yang benar. (Isi/nama file dari Content-Disposition
    // tidak bisa di-mock Playwright untuk unduhan <a download>; diverifikasi di `npm run smoke`.)
    const started = await download;
    expect(new URL(started.url()).pathname).toBe(`/api/jobs/${JOB_ID}/file`);
    await started.cancel();
    await expect(page.getByText("File siap!")).toBeVisible();
    await expect(page.getByRole("link", { name: "Simpan file" })).toHaveAttribute("href", `/api/jobs/${JOB_ID}/file`);
    await page.screenshot({ path: `test-results/screenshots/state-ready-${test.info().project.name}.png`, fullPage: true });

    const history = page.getByRole("region", { name: "Riwayat" });
    await expect(history.getByText(VIDEO_INFO.title)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("region", { name: "Riwayat" }).getByText(VIDEO_INFO.title)).toBeVisible();
    await page.getByRole("button", { name: "Hapus semua" }).click();
    await expect(page.getByRole("region", { name: "Riwayat" })).toHaveCount(0);
  });

  test("error dari API ditampilkan dengan aksi pemulihan", async ({ page }) => {
    await mockInfo(page, {
      status: 403,
      error: { code: "PRIVATE", message: "Video ini privat.", retryable: false },
    });
    await page.goto("/");
    await submitUrl(page);
    const alert = page.getByRole("alert").filter({ hasText: "Tidak bisa diproses" });
    await expect(alert).toContainText("Video ini privat, jadi tidak bisa diunduh.");
    await expect(alert.getByRole("button", { name: "Coba lagi" })).toHaveCount(0);
    await page.screenshot({ path: `test-results/screenshots/state-error-${test.info().project.name}.png`, fullPage: true });
  });

  test("error saat download → bisa pilih kualitas lain", async ({ page }) => {
    await mockInfo(page);
    await mockJob(page, { failWith: { code: "TOO_LARGE", message: "", retryable: false, params: { maxMb: 2048 } } });
    await page.goto("/");
    await submitUrl(page);
    await page.getByRole("button", { name: /Download 4K/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Tidak bisa diproses" })).toContainText("maks 2048 MB");
    await page.getByRole("button", { name: "Pilih kualitas lain" }).click();
    await expect(page.getByRole("button", { name: /Download 4K/ })).toBeVisible();
  });

  test("link dari Share Target (?text=) langsung diproses", async ({ page }) => {
    await mockInfo(page);
    await page.goto(`/?text=${encodeURIComponent(`Tonton ini ${YT_URL} keren`)}`);
    await expect(page.getByRole("heading", { name: VIDEO_INFO.title })).toBeVisible();
    await expect(page.getByLabel("Link video")).toHaveValue(YT_URL);
    expect(new URL(page.url()).search).toBe("");
  });
});

test.describe("tema & bahasa", () => {
  test("tema terang tersimpan setelah reload", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: "Ganti tema terang/gelap" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("ganti ke English & halaman per-platform", async ({ page }) => {
    await page.goto("/tiktok");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("tanpa watermark");
    await page.getByRole("link", { name: /Ganti bahasa/ }).click();
    await expect(page).toHaveURL(/\/en\/tiktok$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("without watermark");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});
