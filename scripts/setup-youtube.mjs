#!/usr/bin/env node
// Skrip otomatis untuk mengaktifkan download YouTube di Vercel.
// Penggunaan: node scripts/setup-youtube.mjs [path-ke-cookies.txt]

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

console.log("\n========================================================");
console.log("       SaveLink — YouTube Unlocker Setup Tool          ");
console.log("========================================================\n");

let cookieFile = process.argv[2];

if (!cookieFile) {
  // Cari otomatis di folder saat ini atau folder Downloads user
  const candidates = [
    path.join(process.cwd(), "cookies.txt"),
    path.join(process.cwd(), "youtube.com_cookies.txt"),
    path.join(os.homedir(), "Downloads", "cookies.txt"),
    path.join(os.homedir(), "Downloads", "youtube.com_cookies.txt"),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      cookieFile = c;
      break;
    }
  }
}

if (!cookieFile || !fs.existsSync(cookieFile)) {
  console.log("File cookies belum ditemukan secara otomatis.\n");
  console.log("Langkah mudah mendapatkan file cookies YouTube (hanya 1 menit):");
  console.log("1. Buka browser Chrome / Edge.");
  console.log("2. Pasang ekstensi gratis: 'Get cookies.txt LOCALLY'");
  console.log("   (https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)");
  console.log("3. Buka tab https://www.youtube.com (login akun YouTube/cadangan).");
  console.log("4. Klik ikon ekstensi tersebut -> klik tombol 'Export' (file cookies.txt akan terunduh).");
  console.log("5. Jalankan kembali perintah ini:");
  console.log("   node scripts/setup-youtube.mjs <path-ke-cookies.txt>");
  console.log("   (Atau cukup letakkan file 'cookies.txt' di folder project ini atau folder Downloads lalu jalankan lagi)\n");
  process.exit(1);
}

console.log(`[1/4] Membaca file cookies dari: ${cookieFile}`);
const content = fs.readFileSync(cookieFile, "utf8");

if (!content.includes("youtube.com") && !content.includes(".youtube.com")) {
  console.warn("PERINGATAN: File tidak tampak memiliki cookies untuk domain youtube.com.");
  console.warn("Pastikan Anda mengekspor cookies saat membuka halaman YouTube.");
}

console.log(`[2/4] Mengonversi cookies ke Base64 (${content.length} bytes)...`);
const base64 = Buffer.from(content, "utf8").toString("base64");

console.log(`[3/4] Mendaftarkan variabel YTDLP_COOKIES_BASE64 ke Vercel...`);
try {
  // Hapus dulu variabel lama jika ada (abaikan jika tidak ada)
  try {
    execSync("npx vercel env rm YTDLP_COOKIES_BASE64 production -y", { stdio: "ignore" });
  } catch {
    // Variabel belum ada, lanjut
  }

  // Tambahkan variabel baru ke production
  execSync("npx vercel env add YTDLP_COOKIES_BASE64 production", {
    input: base64,
    stdio: ["pipe", "inherit", "inherit"],
  });
  console.log("✓ Variabel YTDLP_COOKIES_BASE64 berhasil disimpan di Vercel!");
} catch (err) {
  console.error("Gagal menambahkan environment variable via Vercel CLI:", err.message);
  console.log("\nAnda juga dapat menambahkan secara manual di Vercel Dashboard:");
  console.log("1. Buka https://vercel.com/dashboard -> Project Save-Video -> Settings -> Environment Variables");
  console.log("2. Key: YTDLP_COOKIES_BASE64");
  console.log("3. Value: (salin string Base64 dari file cookies)");
  process.exit(1);
}

console.log(`\n[4/4] Memicu deploy ulang ke Production Vercel...`);
try {
  execSync("npx vercel --prod --yes", { stdio: "inherit" });
  console.log("\n========================================================");
  console.log("✓ SELESAI! YouTube sekarang sudah aktif di Vercel!");
  console.log("Buka situs Anda di https://save-video-bay.vercel.app dan coba download link YouTube.");
  console.log("========================================================\n");
} catch (err) {
  console.error("Gagal deploy otomatis:", err.message);
  console.log("Silakan buka Dashboard Vercel lalu klik 'Redeploy' pada deployment terakhir.");
}
