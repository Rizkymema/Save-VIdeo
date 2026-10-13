/** Dijalankan sekali saat server start: siapkan folder download, bersihkan sisa file, mulai sweeper. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initJobs } = await import("@/lib/jobs/cleanup");
    const { startAutoUpdate } = await import("@/lib/ytdlp/updater");
    await initJobs();
    startAutoUpdate();
  }
}
