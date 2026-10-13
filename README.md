# SaveLink — Download Video dari Link

Web app untuk mengunduh video dari **YouTube, TikTok, Instagram, Facebook, X (Twitter)** dan 1000+ situs lain cukup dengan menempel link — **tanpa login**, kualitas asli sampai **4K**, atau audio **MP3/M4A**.

- **Kualitas tanpa kompresi ulang** — video & audio terbaik digabung ffmpeg (`-c copy`).
- **TikTok tanpa watermark** — otomatis memilih versi tanpa watermark dengan bitrate tertinggi.
- **UI premium** — dark mode (default) + light mode, mobile-first, Bahasa Indonesia & English.
- **Progress real-time** (Server-Sent Events) + batal, riwayat lokal, PWA dengan Share Target Android.
- **Aman untuk publik** — validasi URL anti-SSRF, rate limit per IP, antrean, batas ukuran/durasi, file sementara dihapus otomatis.

> Rencana lengkap & status implementasi: [`docs/PLAN.md`](docs/PLAN.md). Panduan server: [`DEPLOY.md`](DEPLOY.md).

---

## Stack

| Bagian | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components, Turbopack) + React 19 + TypeScript |
| UI | Tailwind CSS v4, shadcn/ui (Radix), Phosphor Icons, Simple Icons, Motion (`LazyMotion`) |
| Mesin download | [yt-dlp](https://github.com/yt-dlp/yt-dlp) + ffmpeg + Deno (JS runtime untuk YouTube) |
| Validasi | Zod |
| Test | Vitest (unit, 179 test) · Playwright + axe-core (E2E & aksesibilitas, 22 test) |
| Deploy | Vercel (mode direct, cukup `git push`), Docker + Caddy di VPS, atau hybrid (lihat DEPLOY.md) |

## Menjalankan di komputer sendiri (Windows)

1. **Pasang tool sistem** (sekali saja):
   ```powershell
   winget install Gyan.FFmpeg
   winget install DenoLand.Deno
   python -m pip install -U "yt-dlp[default,curl-cffi]"   # curl-cffi wajib untuk TikTok
   ```
   Buka terminal baru agar PATH terbaru terbaca, lalu cek: `yt-dlp --version`, `ffmpeg -version`, `deno --version`.

2. **Install dependency & konfigurasi**:
   ```bash
   npm install
   cp .env.example .env.local
   ```
   Bila `deno` belum ada di PATH, isi path lengkapnya di `.env.local`, mis.
   `YTDLP_JS_RUNTIMES=deno:C:\Users\NAMA\AppData\Local\Microsoft\WinGet\Packages\DenoLand.Deno_...\deno.exe`.

3. **Jalankan**:
   ```bash
   npm run dev          # mode pengembangan (http://localhost:3000)
   # atau, lebih ringan untuk PC dengan RAM kecil:
   npm run build && npm start
   ```

Cek kesehatan: buka `http://localhost:3000/api/health` → harus `"ok": true` beserta versi yt-dlp, ffmpeg, dan Deno.

## Script npm

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` / `npm start` | Build & jalankan production |
| `npm run start:standalone` | Jalankan hasil build standalone (persis seperti di Docker) |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Unit test (Vitest) — parser format, error mapping, validasi URL, dll. |
| `npm run test:e2e` | E2E Playwright (API di-mock) + audit aksesibilitas axe |
| `npm run check` | lint + typecheck + test + build sekaligus |
| `npm run smoke -- <url> [preset]` | Uji nyata ke platform: info → job → progress → unduh → ffprobe |
| `npm run screenshots` | Screenshot HP & desktop (gelap/terang) + cek error konsol |
| `npm run icons` | Generate ulang favicon & ikon PWA dari logo |

Contoh smoke test:
```bash
npm run smoke -- "https://www.youtube.com/shorts/YC7pwvv6t78"            # Terbaik (H.264 + AAC)
npm run smoke -- "https://www.tiktok.com/@nba/video/7508215170003488031" audio-m4a
```

## Cara kerja

```
Browser ──POST /api/info──► yt-dlp -J ──► pilihan kualitas (cache 10 menit)
        ──POST /api/jobs──► antrean (maks 3 paralel, 2/IP) ──► yt-dlp + ffmpeg ──► /tmp/savelink/<uuid>.mp4
        ◄─SSE /api/jobs/:id/events── progress (video → audio → merge → siap)
        ──GET /api/jobs/:id/file──► stream file (Range didukung) ──► dihapus otomatis (≤ 30 menit)
```

| Endpoint | Keterangan |
|---|---|
| `POST /api/info` `{ url, item? }` | Metadata + kualitas tersedia. `item` untuk postingan multi-video. |
| `POST /api/jobs` `{ url, preset, item? }` | Buat job → `202 { jobId }`. Preset: `best-compatible`, `v2160`…`v360`, `audio-m4a`, `audio-mp3`. |
| `GET /api/jobs/:id/events` | Server-Sent Events berisi progress. |
| `GET /api/jobs/:id` · `DELETE /api/jobs/:id` | Status (cadangan bila SSE diblokir) · batalkan. |
| `GET /api/jobs/:id/file` | Unduh file (`Content-Disposition` UTF-8, mendukung Range). |
| `GET /api/download?url=&preset=&t=` | Mode direct: proses + kirim file dalam satu request (cookie `sl_dl_<t>` = hasil). |
| `GET /api/health` | Mode, versi tool, sisa disk, antrean, statistik error per platform. |

**Dua mode unduhan** (`DOWNLOAD_MODE`): `jobs` (default di Docker/VPS — antrean + progress real-time via SSE seperti diagram di atas) dan `direct` (otomatis di Vercel — `GET /api/download` memproses lalu langsung mengirim file dalam satu request, hasil dikabarkan lewat cookie `sl_dl_<token>`; binary yt-dlp & ffmpeg Linux diunduh saat build oleh `scripts/fetch-binaries.mjs`).

Semua error berbentuk `{ error: { code, message, retryable, detail?, params? } }` — UI menerjemahkan `code` ke pesan sesuai bahasa.

**Preset "Terbaik"** memilih H.264 + AAC (MP4) agar diputar di semua perangkat termasuk galeri iPhone. 1440p/4K YouTube memakai VP9/AV1 (ditandai di UI), TikTok 720p/1080p memakai HEVC.

### Struktur folder

```
src/
├─ app/                 # halaman (ID di /, EN di /en), API routes, manifest, sitemap, OG image
├─ components/
│  ├─ downloader/       # input, preview, pilihan kualitas, progress, error, riwayat
│  ├─ layout/ pages/ sections/ brand/ pwa/ ui/
├─ hooks/               # useVideoInfo, useDownloadJob (SSE + fallback polling), useHistory, useTheme
├─ i18n/                # kamus id/en
├─ lib/
│  ├─ ytdlp/            # runner (spawn tanpa shell), args, parse-formats, progress, errors, updater
│  ├─ jobs/             # store, queue, cleanup
│  └─ …                 # env, rate-limit, request-ip, net (anti-SSRF), url-guard, metrics, turnstile
tests/unit · tests/e2e · tests/fixtures (metadata asli yt-dlp, sudah dipangkas)
design-system/MASTER.md # token desain (hasil skill ui-ux-pro-max + koreksi kontras)
```

## Konfigurasi

Semua variabel ada di [`.env.example`](.env.example) beserta penjelasannya: batas ukuran/durasi, antrean, rate limit, header IP proxy, proxy/cookies yt-dlp (opsional), Cloudflare Turnstile (opsional), webhook alert, dan `NEXT_PUBLIC_SITE_URL`.

## Masalah umum

| Gejala | Penyebab & solusi |
|---|---|
| YouTube: *"Sign in to confirm you're not a bot"* | IP server (datacenter) diblokir. Pastikan yt-dlp terbaru & Deno terpasang; bila masih, isi `YTDLP_PROXY` (proxy residensial) atau jalankan di server rumah. |
| TikTok: *"Unexpected response from webpage request"* | yt-dlp tanpa `curl_cffi`. Pasang `pip install "yt-dlp[default,curl-cffi]"` (binary resmi di Docker sudah menyertakannya). |
| Instagram/Facebook: *"butuh login"* | Konten privat atau IG membatasi IP. Hanya konten publik yang didukung; `YTDLP_COOKIES_FILE` opsional (pakai akun cadangan). |
| `next dev` crash *"Fatal process out of memory"* | RAM komputer tidak cukup untuk Turbopack dev. Pakai `npm run build && npm start`. |
| Opsi 4K tidak terputar di galeri iPhone | 4K YouTube memakai VP9/AV1. Gunakan VLC atau pilih opsi "Terbaik" (H.264). |

## Legal

Hanya untuk konten milik sendiri atau yang Anda punya izin untuk mengunduhnya. SaveLink tidak menyimpan atau menghosting ulang video dan tidak berafiliasi dengan platform mana pun. Lihat halaman `/terms` & `/privacy`.
