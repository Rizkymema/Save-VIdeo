# Plan — SaveLink: Video Downloader dari Link (Next.js)

> Nama kerja: **SaveLink** (bisa diganti). Dokumen ini adalah rencana kerja lengkap dari setup sampai deploy.
> Disusun memakai skill di `D:\SKILL AI` (lihat bagian 12 untuk peta skill per fase).
>
> **Status (13 Oktober 2026): Fase 0–5 selesai & terverifikasi, Fase 6 siap dijalankan di VPS, Fase 7 sebagian.**
> Kode ada di folder `savelink/`. Rincian bukti & perubahan dari rencana: **bagian 15**.

---

## 1. Ringkasan

**Tujuan:** Web app tempat user cukup **menempel link** (YouTube, TikTok, Instagram, Facebook, X/Twitter, dan situs lain yang didukung) lalu **memilih kualitas** (sampai 4K untuk YouTube, atau MP3/M4A untuk audio) dan langsung download, **tanpa login dan tanpa daftar akun**.

**Prinsip utama:**
1. **Kualitas maksimal tanpa re-encode.** Video dan audio terbaik digabung (merge) apa adanya, tanpa kompresi ulang.
2. **Nol friksi.** Tempel link, video otomatis terdeteksi, pilih kualitas, lalu download. Tidak ada login, tidak ada popup.
3. **UI premium & cepat.** Dark mode sebagai tampilan utama, mobile-first, ada state loading/error yang jelas.
4. **Aman dari penyalahgunaan.** Ada rate limit per IP, validasi URL, batas ukuran/durasi, dan file sementara dihapus otomatis.

**Non-goals (tidak dikerjakan di MVP):** akun user, pembayaran, download konten privat (yang butuh login), download playlist/channel massal, menyimpan video permanen di server.

---

## 2. Keputusan Teknis Utama

| Aspek | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript**, versi stabil terbaru (`create-next-app@latest`) | Sesuai permintaan. Frontend dan API ada dalam satu project. |
| Styling | **Tailwind CSS v4 + shadcn/ui** | Cepat, konsisten, dan berbasis design token. |
| Ikon | **Phosphor Icons** (`@phosphor-icons/react`) + **Simple Icons** untuk logo platform | Default dari skill ui-ux-pro-max. Logo brand harus resmi, bukan emoji. |
| Animasi | **Motion** (`motion/react`) | Untuk transisi kartu dan progress. Wajib menghormati `prefers-reduced-motion`. |
| Validasi | **Zod** | Untuk validasi input di boundary API (sesuai nextjs-website-skill). |
| Toast | **Sonner** (bawaan shadcn) | Notifikasi sukses/gagal. |
| **Mesin download** | **yt-dlp** | Mendukung 1000+ situs (YT, TikTok, IG, FB, X, Reddit, Vimeo, dll.), aktif di-maintain, dan bisa memilih format terbaik. |
| **Penggabung video+audio** | **ffmpeg** | YouTube ≥1080p memisahkan stream video dan audio (DASH), jadi harus di-merge. yt-dlp memakai `-c copy`, sehingga kualitas tidak turun. |
| JS runtime untuk yt-dlp | **Deno** | Versi yt-dlp terbaru butuh JS runtime eksternal agar format YouTube lengkap. |
| Runtime server | **Node.js LTS**, Route Handlers `runtime = 'nodejs'` | Perlu `child_process` untuk menjalankan yt-dlp, filesystem untuk file sementara, dan streaming. |
| Hosting | **VPS + Docker** (bukan Vercel) | Vercel/serverless punya batas durasi function, tidak ada ffmpeg/yt-dlp, dan IP datacenter-nya cepat diblokir. Detail di bagian 10. |
| Penyimpanan | **Tanpa database.** Job disimpan di memori, file di folder temp, riwayat user di `localStorage` | Tidak ada login, jadi tidak perlu DB. Lebih sederhana dan murah. |

---

## 3. Arsitektur & Alur Data

```
[Browser]
   │ 1. POST /api/info  { url }
   ▼
[Next.js Route Handler] ──spawn──► yt-dlp -J (ambil metadata, tanpa download)
   │ ◄── title, thumbnail, durasi, daftar format
   │ normalisasi → preset kualitas (2160p/1080p/720p/MP3/...)
   ▼
[Browser] tampilkan preview + tombol kualitas
   │ 2. POST /api/jobs  { url, preset }
   ▼
[Job Queue (in-memory, concurrency terbatas)]
   │ spawn yt-dlp -f/-S <preset> --merge-output-format mp4 -o /tmp/savelink/<jobId>.%(ext)s
   │ parse progress JSON per baris
   │ 3. GET /api/jobs/:id/events  (SSE) ──► progress %, speed, ETA, tahap
   ▼
[File siap di /tmp/savelink]
   │ 4. GET /api/jobs/:id/file  → stream file + Content-Disposition (attachment)
   ▼
[Browser] download native via <a href download> (tidak memakai blob, aman untuk file besar)
   │
[Cleanup] hapus file setelah selesai di-stream + sweeper tiap 5 menit (TTL 30 menit)
```

**Kenapa memakai sistem "job", bukan langsung stream?**
- Video YouTube HD perlu di-*merge* dulu oleh ffmpeg. Format MP4 butuh file utuh (atom `moov`) sebelum bisa diputar dengan benar.
- User bisa melihat progress yang nyata (download video, download audio, merging, siap).
- Satu pipeline untuk semua platform membuat kode lebih sederhana. Optimasi "direct stream" untuk format tanpa merge (TikTok/IG) ditunda ke fase lanjutan.

---

## 4. Strategi "Kualitas Bagus" per Platform

Client **tidak pernah** mengirim string format yt-dlp mentah. Client hanya mengirim **preset** dari enum, lalu server yang menerjemahkannya. Ini lebih aman dan lebih mudah dikontrol.

| Preset | Argumen yt-dlp (server-side) | Catatan |
|---|---|---|
| `best-compatible` | `-S "res,vcodec:h264,acodec:aac" -f "bv*+ba/b" --merge-output-format mp4` | **Default.** MP4 H.264 + AAC, bisa diputar di semua HP termasuk galeri iPhone. Di YouTube umumnya maksimal 1080p. |
| `v2160` / `v1440` | `-S "res:2160" -f "bv*+ba/b" --merge-output-format mp4` | 4K/2K memakai VP9/AV1. Beri label: *"Kualitas tertinggi — bisa tidak terputar di galeri iPhone, gunakan VLC"*. |
| `v1080` / `v720` / `v480` / `v360` | `-S "res:<H>,vcodec:h264,acodec:aac" -f "bv*+ba/b" --merge-output-format mp4` | Batas atas resolusi, dengan prioritas codec yang kompatibel. |
| `audio-m4a` | `-f "ba[ext=m4a]/ba" ` | Audio asli tanpa transcode (kualitas terbaik). |
| `audio-mp3` | `-x --audio-format mp3 --audio-quality 0` | Re-encode ke MP3 VBR tertinggi (paling kompatibel). |

**Catatan per platform:**
- **YouTube (termasuk Shorts):** sumber kualitas tertinggi adalah DASH, jadi wajib ffmpeg merge. Tampilkan semua resolusi yang benar-benar tersedia (dibaca dari hasil `-J`).
- **TikTok:** utamakan format **tanpa watermark** dan bitrate tertinggi. Utamakan H.264 daripada H.265 (`bytevc1`) untuk kompatibilitas.
- **Instagram (Reels/post):** umumnya MP4 sampai 1080p. Kadang terpisah video/audio, jadi tetap lewat merge. Konten akun privat tidak bisa diambil.
- **Facebook (video/Reels/fb.watch):** pilih HD jika tersedia, selain itu SD. Hanya untuk video publik.
- **X/Twitter, Reddit, Vimeo, Dailymotion, Pinterest, dll.:** otomatis didukung oleh extractor yt-dlp.

**Aturan normalisasi format** (`lib/ytdlp/parse-formats.ts`):
- Kelompokkan berdasarkan tinggi resolusi, buang duplikat, dan ambil estimasi ukuran file (`filesize` atau `filesize_approx`, dijumlah video + audio).
- Hanya tampilkan preset yang resolusinya **benar-benar ada** di video tersebut. Jangan tampilkan "4K" untuk video 720p.
- Tandai preset "Direkomendasikan" (`best-compatible`).

---

## 5. Struktur Folder

```
savelink/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx                 # font, theme provider, metadata, Toaster
│  │  ├─ page.tsx                   # Home (downloader utama)
│  │  ├─ [platform]/page.tsx        # Landing SEO: /youtube /tiktok /instagram /facebook (fase 5)
│  │  ├─ terms/page.tsx             # Syarat & disclaimer
│  │  ├─ privacy/page.tsx
│  │  ├─ manifest.ts                # PWA manifest + share_target (fase 5)
│  │  └─ api/
│  │     ├─ info/route.ts           # POST → metadata + preset tersedia
│  │     ├─ jobs/route.ts           # POST → buat job download
│  │     ├─ jobs/[id]/events/route.ts  # GET (SSE) → progress
│  │     ├─ jobs/[id]/file/route.ts    # GET → stream file
│  │     └─ health/route.ts         # cek yt-dlp/ffmpeg/deno tersedia + versi
│  ├─ components/
│  │  ├─ ui/                        # shadcn (button, card, input, progress, skeleton, ...)
│  │  ├─ layout/                    # Header, Footer, ThemeToggle
│  │  └─ downloader/
│  │     ├─ UrlInputForm.tsx        # input + tombol Tempel + deteksi platform
│  │     ├─ PlatformBadge.tsx
│  │     ├─ SupportedPlatforms.tsx
│  │     ├─ VideoPreviewCard.tsx    # thumbnail, judul, uploader, durasi
│  │     ├─ VideoPreviewSkeleton.tsx
│  │     ├─ QualitySelector.tsx     # grid preset video + audio
│  │     ├─ DownloadProgress.tsx    # bar + tahap + speed + ETA
│  │     ├─ ErrorState.tsx          # pesan + aksi pemulihan
│  │     ├─ HistoryList.tsx         # riwayat lokal
│  │     ├─ HowItWorks.tsx
│  │     └─ Faq.tsx
│  ├─ hooks/
│  │  ├─ useVideoInfo.ts            # panggil /api/info, state machine
│  │  ├─ useDownloadJob.ts          # buat job + EventSource SSE
│  │  └─ useHistory.ts              # localStorage (try/catch)
│  ├─ lib/                          # semua file di sini: import 'server-only' (kecuali yang shared)
│  │  ├─ ytdlp/
│  │  │  ├─ runner.ts               # spawn (tanpa shell), timeout, kill, collect stderr
│  │  │  ├─ args.ts                 # base args + preset → args
│  │  │  ├─ parse-formats.ts        # JSON yt-dlp → VideoInfo + preset
│  │  │  ├─ progress.ts             # parse baris progress JSON
│  │  │  └─ errors.ts               # stderr → kode error ramah user
│  │  ├─ jobs/
│  │  │  ├─ store.ts                # Map<jobId, Job> di globalThis
│  │  │  ├─ queue.ts                # batas concurrency global & per IP
│  │  │  └─ cleanup.ts              # sweeper TTL
│  │  ├─ platforms.ts               # deteksi platform dari hostname (shared)
│  │  ├─ rate-limit.ts              # sliding window per IP
│  │  ├─ request-ip.ts              # cf-connecting-ip / x-forwarded-for
│  │  ├─ cache.ts                   # LRU cache info per URL (10 menit)
│  │  ├─ filename.ts                # sanitasi judul → nama file aman (RFC 5987)
│  │  └─ env.ts                     # baca & validasi env dengan zod
│  ├─ types/
│  │  └─ video.ts                   # VideoInfo, QualityPreset, Job, ApiError
│  └─ constants/
│     ├─ presets.ts
│     └─ messages.ts                # copy error/sukses (Bahasa Indonesia)
├─ design-system/
│  └─ MASTER.md                     # hasil ui-ux-pro-max --persist
├─ tests/
│  ├─ fixtures/                     # contoh JSON yt-dlp per platform
│  ├─ unit/                         # parse-formats, platforms, errors, filename
│  └─ e2e/                          # Playwright alur utama
├─ Dockerfile
├─ docker-compose.yml
├─ .env.example
└─ next.config.ts                   # output: 'standalone', images.remotePatterns
```

---

## 6. Kontrak API & Types

```ts
// src/types/video.ts
export type Platform =
  | 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'twitter' | 'other';

export type QualityPreset =
  | 'best-compatible' | 'v2160' | 'v1440' | 'v1080' | 'v720' | 'v480' | 'v360'
  | 'audio-m4a' | 'audio-mp3';

export interface QualityOption {
  preset: QualityPreset;
  kind: 'video' | 'audio';
  label: string;            // "1080p", "4K", "MP3"
  ext: 'mp4' | 'm4a' | 'mp3';
  approxBytes?: number;
  fps?: number;
  recommended?: boolean;
  note?: string;            // "Mungkin tidak terputar di galeri iPhone"
}

export interface VideoInfo {
  sourceUrl: string;
  platform: Platform;
  title: string;
  uploader?: string;
  thumbnail?: string;
  durationSec?: number;
  options: QualityOption[];
}

export type JobStage = 'queued' | 'downloading' | 'merging' | 'ready' | 'error' | 'expired';

export interface JobProgress {
  stage: JobStage;
  percent?: number;         // 0–100
  speedBps?: number;
  etaSec?: number;
  error?: ApiError;
}

export interface ApiError {
  code:
    | 'INVALID_URL' | 'UNSUPPORTED' | 'PRIVATE' | 'LOGIN_REQUIRED' | 'AGE_RESTRICTED'
    | 'GEO_BLOCKED' | 'NOT_FOUND' | 'TOO_LONG' | 'TOO_LARGE' | 'RATE_LIMITED'
    | 'BUSY' | 'BLOCKED_BY_PLATFORM' | 'TIMEOUT' | 'UNKNOWN';
  message: string;          // pesan ramah user (Bahasa Indonesia)
  retryable: boolean;
}
```

| Endpoint | Request | Response | Catatan |
|---|---|---|---|
| `POST /api/info` | `{ url: string }` | `200 VideoInfo` / `4xx ApiError` | Ada cache 10 menit dan rate limit 15/menit/IP. |
| `POST /api/jobs` | `{ url: string, preset: QualityPreset }` | `202 { jobId }` | Maksimal 2 job aktif per IP, `429` jika antrean penuh. |
| `GET /api/jobs/:id/events` | — | `text/event-stream` berisi `JobProgress` | Header `X-Accel-Buffering: no`. Stream ditutup saat `ready`/`error`. |
| `GET /api/jobs/:id/file` | — | stream file | `Content-Disposition: attachment; filename*=UTF-8''<judul>.mp4`, plus `Content-Length`. |
| `GET /api/health` | — | `{ ok, ytdlp, ffmpeg, deno }` | Untuk monitoring. |

Semua route handler wajib memakai: `export const runtime = 'nodejs'` dan `export const dynamic = 'force-dynamic'`.
API ini sengaja dibuat sebagai REST (bukan Server Action) supaya **bisa dipakai ulang oleh aplikasi Android (APK) nanti**.

---

## 7. Keamanan & Anti-Abuse (tanpa login)

Mengacu ke skill `cyber-security/application-security-engineer.md` dan `harden` dari impeccable.

| Risiko | Mitigasi |
|---|---|
| **Command injection** | Gunakan `spawn(binary, argsArray)` **tanpa shell**. URL selalu diletakkan setelah `--` agar tidak terbaca sebagai opsi. Preset hanya dari enum. |
| **SSRF** (user memasukkan URL internal) | Hanya izinkan `http/https`, tolak IP literal dan `localhost`. Nonaktifkan extractor generic dengan `--ies default,-generic`, sehingga hanya domain yang dikenal yt-dlp yang diproses. |
| **Spam / bot** | Rate limit per IP (info 15/menit, job 2 aktif). Opsional: **Cloudflare Turnstile** (captcha tak terlihat, user tetap tidak perlu login). |
| **Disk penuh** | `--max-filesize` (default 2 GB), batas durasi (default 2 jam, dicek dari hasil `-J`), TTL file 30 menit, sweeper, dan cek sisa disk sebelum job dimulai. |
| **CPU/RAM habis** | Batasi concurrency global (`MAX_CONCURRENT_JOBS`, misal 3) dan timeout per proses (info 30 detik, job 15 menit) yang mematikan proses jika lewat. |
| **Path traversal** | Nama file di disk memakai `jobId` (UUID). Judul video hanya dipakai di header `Content-Disposition` setelah disanitasi. |
| **Job milik orang lain** | `jobId` berupa UUID acak (sulit ditebak) dan tidak ada daftar job yang bisa diakses publik. |
| **Secret** | Cookies/proxy (jika dipakai) hanya disimpan di env server, tidak pernah dikirim ke client. |

---

## 8. Desain UI/UX

### 8.1 Design system (hasil `ui-ux-pro-max`)
Perintah yang sudah dijalankan untuk riset:
```bash
python scripts/search.py "utility tool converter downloader dark mode premium minimal content-first" \
  --design-system -p "SaveLink" --variance 4 --motion 4 --density 5
```
Hasil yang dipakai:
- **Style:** *Modern Dark (Cinema)*, yaitu dark mode sebagai tampilan utama, ambient glow halus, aksen glassmorphism tipis di header, dan tanpa hitam pekat (`#000`).
- **Font:** **Inter** (heading + body, beberapa weight). Opsional **JetBrains Mono** untuk metadata (resolusi, ukuran file).
- **Motion:** easing `cubic-bezier(0.16, 1, 0.3, 1)`, durasi 150–300 ms, kartu kualitas muncul bertahap (*stagger*), tombol menyusut ke 0.97 saat ditekan.
- **Anti-pattern:** light mode sebagai default, animasi lambat, emoji sebagai ikon.

### 8.2 Token warna (sudah dicek kontrasnya)
| Token | Dark (default) | Light | Catatan kontras |
|---|---|---|---|
| `--bg` | `#141110` | `#FAFAF9` | |
| `--surface` | `#1C1917` | `#FFFFFF` | |
| `--surface-2` | `#292524` | `#F5F5F4` | |
| `--border` | `rgba(255,255,255,.08)` | `#E7E5E4` | |
| `--text` | `#FAFAF9` | `#1C1917` | ≥ 15:1 |
| `--text-muted` | `#A8A29E` | `#57534E` | ≥ 7:1 |
| `--primary` (tombol CTA) | `#F97316` + **teks gelap `#1C1917`** | `#C2410C` + teks putih | ≈ 5.9:1 / ≈ 5.2:1. **Jangan** teks putih di atas `#F97316` (hanya ≈ 2.9:1). |
| `--accent` (link/info) | `#3B82F6` | `#2563EB` | ≥ 4.5:1 |
| `--success` | `#22C55E` | `#15803D` | |
| `--danger` | `#F87171` | `#DC2626` | |

Simpan hasil final ke `design-system/MASTER.md` dengan `--persist` di Fase 0, lalu masukkan ke `@theme` Tailwind v4.

### 8.3 Wireframe halaman utama (mobile-first)
```
┌─────────────────────────────────────────────┐
│ [logo] SaveLink              [ID/EN] [tema] │  ← header glass, sticky
├─────────────────────────────────────────────┤
│      Download video dari link apa pun       │  ← H1, text-wrap: balance
│   Kualitas HD sampai 4K · Tanpa login       │
│                                             │
│ ┌─[ikon platform]─────────────────┬───────┐ │
│ │ Tempel link video di sini...    │Tempel │ │  ← input besar, autofocus
│ └─────────────────────────────────┴───────┘ │
│            [  Ambil Video  ]                │  ← CTA primary
│  [YT] [TikTok] [IG] [FB] [X] +1000 situs    │  ← logo platform didukung
├─────────────────────────────────────────────┤
│ ┌───────────┐ Judul video yang panjang...   │  ← VideoPreviewCard
│ │ thumbnail │ @uploader · 03:24             │
│ │   [play]  │ [badge TikTok]                │
│ └───────────┘                               │
│ VIDEO                                       │
│ [★ Terbaik 1080p · 80 MB] [4K · 245 MB]     │  ← QualitySelector (grid 2 kolom HP,
│ [720p · 40 MB] [480p · 22 MB]               │     4 kolom desktop)
│ AUDIO                                       │
│ [MP3 · 3 MB] [M4A asli · 3 MB]              │
│                                             │
│ ███████████████░░░░░░  62% · 3.1 MB/s · 0:12│  ← DownloadProgress (aria-live)
│ Mengunduh video → Mengunduh audio → Menggabung│
├─────────────────────────────────────────────┤
│ Riwayat (tersimpan di perangkat ini)  Hapus │
│ Cara pakai (3 langkah) · FAQ · Disclaimer   │
└─────────────────────────────────────────────┘
```

### 8.4 State machine kartu downloader
`idle → validating → fetchingInfo (skeleton) → infoReady → jobQueued → downloading (%) → merging (indeterminate) → ready (download otomatis + tombol "Download ulang") → error (pesan + aksi)`

### 8.5 Detail UX penting
- **Auto-fetch saat paste.** Jika teks yang ditempel adalah URL valid, info langsung diambil tanpa perlu klik tombol.
- **Tombol "Tempel"** hanya muncul jika `navigator.clipboard.readText` didukung browser.
- **Deteksi platform instan** dari hostname, ditandai ikon di dalam input sebelum request ke server.
- **Download memakai `<a href download>`**, bukan `fetch` lalu blob, supaya file 1 GB+ tidak memenuhi RAM HP.
- **Riwayat lokal**: 20 item terakhir di `localStorage` (dibungkus try/catch), dengan tombol hapus semua. Tidak ada data yang dikirim ke server.
- **Tips iPhone** di FAQ: file masuk ke app *Files* → *Bagikan* → *Simpan Video*.
- Error memakai `role="alert"` dan selalu disertai **aksi pemulihan** (Coba lagi / Pilih kualitas lain / Cek link).
- Touch target ≥ 44 px, fokus keyboard terlihat, `cursor-pointer` di semua elemen klik.
- Responsive diuji di 375 / 768 / 1024 / 1440 px. Hormati `prefers-reduced-motion`.

### 8.6 Copy error (skill `ux-writing.md`)
| Kode | Pesan | Aksi |
|---|---|---|
| `INVALID_URL` | "Link-nya sepertinya tidak lengkap. Salin ulang dari tombol *Bagikan → Salin link*." | Fokus ke input |
| `UNSUPPORTED` | "Situs ini belum didukung." | Lihat daftar situs |
| `PRIVATE` / `LOGIN_REQUIRED` | "Video ini privat atau butuh login, jadi tidak bisa diunduh." | — |
| `AGE_RESTRICTED` | "Video ini dibatasi umur oleh platform." | — |
| `GEO_BLOCKED` | "Video ini tidak tersedia di wilayah server kami." | — |
| `NOT_FOUND` | "Video tidak ditemukan atau sudah dihapus." | — |
| `TOO_LONG` / `TOO_LARGE` | "Video terlalu panjang/besar (maks 2 jam / 2 GB). Coba kualitas lebih rendah." | Pilih kualitas lain |
| `RATE_LIMITED` / `BUSY` | "Server sedang ramai. Coba lagi dalam beberapa detik." | Coba lagi (countdown) |
| `BLOCKED_BY_PLATFORM` | "Platform sedang membatasi server kami. Coba lagi nanti." | Coba lagi |
| `TIMEOUT` / `UNKNOWN` | "Ada kendala saat memproses video." | Coba lagi |

---

## 9. Tahapan Implementasi

Setiap task punya **bukti selesai** (sesuai `00-core/implementation-planning.md`).

### Fase 0 — Setup & Design System
| # | Task | Bukti selesai |
|---|---|---|
| 0.1 | Install tool lokal (Windows): `winget install yt-dlp.yt-dlp`, `winget install Gyan.FFmpeg`, `winget install DenoLand.Deno` | `yt-dlp --version`, `ffmpeg -version`, `deno --version` jalan |
| 0.2 | `npx create-next-app@latest savelink --ts --tailwind --app --src-dir --eslint` | `npm run dev` membuka halaman default |
| 0.3 | `npx shadcn@latest init` + komponen: button, input, card, progress, skeleton, badge, sonner, accordion | Komponen bisa di-import |
| 0.4 | Install: `zod motion @phosphor-icons/react @icons-pack/react-simple-icons next-themes server-only` | Build bersih |
| 0.5 | Jalankan ui-ux-pro-max `--design-system --persist -p "SaveLink"`, lalu pindahkan token ke `globals.css` (`@theme`), set font Inter via `next/font` | `design-system/MASTER.md` ada, dark/light token aktif |
| 0.6 | `next.config.ts`: `output: 'standalone'`, `images.remotePatterns` untuk `i.ytimg.com`, `**.tiktokcdn.com`, `**.cdninstagram.com`, `**.fbcdn.net`, `pbs.twimg.com` | Thumbnail tampil via `next/image` |
| 0.7 | `lib/env.ts` + `.env.example` (lihat bagian 10.3) | App gagal start dengan pesan jelas jika env salah |

### Fase 1 — Engine: Ambil Info Video
| # | Task | Bukti selesai |
|---|---|---|
| 1.1 | `lib/platforms.ts`: deteksi platform dan validasi URL (http/https, tolak IP/localhost) | Unit test lulus untuk 20+ variasi URL (termasuk `youtu.be`, `vm.tiktok.com`, `fb.watch`, Shorts, Reels) |
| 1.2 | `lib/ytdlp/runner.ts`: `spawn` tanpa shell, timeout, kill, kumpulkan stdout/stderr | Test: proses dibunuh saat lewat timeout |
| 1.3 | `lib/ytdlp/args.ts`: base args `--no-playlist --ies default,-generic --socket-timeout 15 --no-warnings` | Snapshot test args |
| 1.4 | Simpan **fixture JSON** asli: `yt-dlp -J <url> > tests/fixtures/<platform>.json` (YT biasa, YT Shorts, TikTok, IG Reel, FB, X) | 6+ fixture tersimpan |
| 1.5 | `lib/ytdlp/parse-formats.ts`: JSON → `VideoInfo` + preset yang tersedia + estimasi ukuran | Unit test per fixture lulus |
| 1.6 | `lib/ytdlp/errors.ts`: pola stderr → `ApiError` | Unit test per kode error |
| 1.7 | `lib/cache.ts` (LRU 10 menit) + `lib/rate-limit.ts` | Request ke-16 dalam 1 menit menghasilkan `429` |
| 1.8 | `app/api/info/route.ts`: zod → rate limit → cache → yt-dlp → parse | `curl -X POST /api/info` dengan link asli tiap platform mengembalikan JSON benar |

### Fase 2 — Engine: Download Job, Progress, Streaming
| # | Task | Bukti selesai |
|---|---|---|
| 2.1 | `lib/jobs/store.ts` (Map di `globalThis`, aman saat HMR) + `queue.ts` (concurrency global & per IP) | Job ke-4 berstatus `queued` saat batas 3 |
| 2.2 | Preset → args (tabel bagian 4) + `--newline --progress-template "download:%(progress)j" --print after_move:filepath -o <DIR>/<jobId>.%(ext)s` | Download YT 1080p menghasilkan 1 file MP4 berisi video + audio |
| 2.3 | `lib/ytdlp/progress.ts`: parse JSON progress, deteksi tahap (video → audio → merging) | Unit test dengan sample output |
| 2.4 | `POST /api/jobs` | Mengembalikan `202 { jobId }` |
| 2.5 | `GET /api/jobs/[id]/events` (SSE via `ReadableStream`) | `curl -N` menampilkan event progress sampai `ready` |
| 2.6 | `GET /api/jobs/[id]/file`: `fs.createReadStream` → `Readable.toWeb` → `Response`, plus `Content-Length` dan `Content-Disposition` RFC 5987 (judul ber-emoji/Unicode tetap aman) | Browser menyimpan file dengan nama judul yang benar |
| 2.7 | `lib/jobs/cleanup.ts`: hapus file setelah stream selesai + sweeper TTL 30 menit + bersihkan folder temp saat start | Folder temp kosong setelah TTL |
| 2.8 | Verifikasi kualitas: `ffprobe` hasil download untuk memastikan resolusi/codec sesuai preset dan durasi audio = video | Checklist QA kualitas lulus (bagian 11) |

### Fase 3 — UI Utama
| # | Task | Bukti selesai |
|---|---|---|
| 3.1 | Layout: Header (glass, sticky), Footer, ThemeToggle (`next-themes`, default dark) | Tidak ada flash tema salah saat reload |
| 3.2 | `UrlInputForm` + `PlatformBadge` + auto-fetch saat paste + tombol Tempel | Paste link langsung memunculkan skeleton |
| 3.3 | `useVideoInfo` (state machine bagian 8.4) + `VideoPreviewSkeleton` + `VideoPreviewCard` | Semua state terlihat (uji dengan throttling) |
| 3.4 | `QualitySelector` (grid, badge "Direkomendasikan", ukuran file, catatan codec) | Preset yang tidak tersedia tidak muncul |
| 3.5 | `useDownloadJob` (EventSource) + `DownloadProgress` (aria-live, tahap, speed, ETA) | Progress bergerak real-time, dan download otomatis saat `ready` |
| 3.6 | `ErrorState` + mapping copy (bagian 8.6) + toast Sonner | Setiap kode error menampilkan pesan + aksi |
| 3.7 | `useHistory` + `HistoryList` | Riwayat bertahan setelah reload, dan halaman tetap jalan jika localStorage diblokir |
| 3.8 | `SupportedPlatforms`, `HowItWorks`, `Faq` (accordion), halaman `/terms` dan `/privacy` | Konten lengkap |

### Fase 4 — Hardening
| # | Task | Bukti selesai |
|---|---|---|
| 4.1 | Batas durasi/ukuran + cek ruang disk sebelum job | Video > 2 jam ditolak dengan `TOO_LONG` |
| 4.2 | `request-ip.ts` (dukung Cloudflare/Nginx) | Rate limit berlaku per IP asli, bukan IP proxy |
| 4.3 | Opsional: Cloudflare Turnstile (invisible) di `POST /api/jobs` | Request tanpa token ditolak |
| 4.4 | Uji abuse: URL `http://127.0.0.1`, `file://`, URL diawali `-`, string 10 KB, preset palsu | Semua ditolak `400` dan tidak ada proses yt-dlp yang dijalankan |
| 4.5 | Logging terstruktur (jobId, platform, durasi proses, kode error), **tanpa** menyimpan URL user lebih lama dari yang diperlukan | Log terbaca saat debugging |

### Fase 5 — Polish UI, SEO, PWA
| # | Task | Bukti selesai |
|---|---|---|
| 5.1 | Jalankan skill **impeccable** `audit` lalu `polish` di halaman utama | Temuan prioritas tinggi sudah diperbaiki |
| 5.2 | Audit aksesibilitas (`accessibility-engineer.md` / design:accessibility-review): kontras, fokus, label, reduced motion | WCAG 2.1 AA lulus untuk alur utama |
| 5.3 | Motion: stagger kartu kualitas, transisi state kartu, progress halus | Mati otomatis saat `prefers-reduced-motion` |
| 5.4 | Metadata SEO + OG image + halaman `/[platform]` (memakai komponen yang sama, beda copy & H1) | Lighthouse SEO ≥ 95 |
| 5.5 | PWA: `manifest.ts` + **Web Share Target**, sehingga di Android bisa *Bagikan dari TikTok/IG → SaveLink* dan link langsung terisi | Uji share dari app TikTok di HP Android |
| 5.6 | Lighthouse mobile: Performance ≥ 90, LCP < 2.5 s, CLS < 0.1 | Laporan Lighthouse |

### Fase 6 — Deploy
| # | Task | Bukti selesai |
|---|---|---|
| 6.1 | `Dockerfile` multi-stage (bagian 10.1) | `docker run` lokal: alur penuh berhasil |
| 6.2 | VPS (min 2 vCPU / 4 GB RAM / 40 GB SSD) + Docker Compose + reverse proxy (Caddy/Nginx, HTTPS otomatis) | Domain HTTPS aktif |
| 6.3 | Konfigurasi proxy: `proxy_buffering off` (SSE), `proxy_read_timeout 900s`, tanpa batas ukuran response | Progress SSE lancar di production |
| 6.4 | **Auto-update yt-dlp** (cron mingguan rebuild image, atau `yt-dlp -U` harian) | Versi yt-dlp di `/api/health` selalu terbaru |
| 6.5 | Monitoring: uptime check `/api/health` + alert jika error rate naik | Notifikasi masuk saat simulasi down |

### Fase 7 — Opsional / Lanjutan
- **APK Android** via TWA (Bubblewrap) dari PWA, atau Capacitor. Memakai API yang sama.
- **Direct stream** untuk format tanpa merge (TikTok/IG) dengan `-o -` di-pipe ke response, sehingga download lebih cepat tanpa menunggu file selesai.
- **Carousel Instagram** (multi video/foto): tampilkan daftar item (`--playlist-items N`).
- Download **subtitle** YouTube, potong video (trim), konversi GIF.
- i18n ID/EN (`next-intl`).
- Scale: Redis + BullMQ + worker terpisah jika traffic besar atau perlu banyak instance.

---

## 10. Deployment

### 10.1 Dockerfile (garis besar)
```dockerfile
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg python3 ca-certificates curl unzip \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production DOWNLOAD_DIR=/tmp/savelink
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

### 10.2 Kenapa bukan Vercel?
- Function serverless punya batas durasi, sementara merge video 4K bisa berjalan beberapa menit.
- Tidak ada `ffmpeg`/`yt-dlp`/`deno` bawaan, dan job in-memory tidak bertahan antar invocation.
- IP datacenter serverless sering diblokir YouTube ("Sign in to confirm you're not a bot").
- Alternatif jika tetap ingin memakai Vercel: **frontend di Vercel + API/worker di VPS** (set `NEXT_PUBLIC_API_BASE`).

### 10.3 Environment
```env
YTDLP_PATH=yt-dlp
FFMPEG_PATH=ffmpeg
DOWNLOAD_DIR=/tmp/savelink
MAX_CONCURRENT_JOBS=3
MAX_JOBS_PER_IP=2
RATE_LIMIT_INFO_PER_MIN=15
MAX_DURATION_SEC=7200
MAX_FILESIZE_MB=2048
JOB_TTL_MINUTES=30
INFO_TIMEOUT_SEC=30
JOB_TIMEOUT_SEC=900
# Opsional
YTDLP_PROXY=            # proxy residensial jika IP server diblokir
YTDLP_COOKIES_FILE=     # HATI-HATI: akun bisa kena banned, pakai akun cadangan
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

---

## 11. Testing & QA

**Otomatis**
- **Unit (Vitest):** `platforms`, `parse-formats` (pakai fixture), `errors`, `progress`, `filename`, `rate-limit`.
- **E2E (Playwright, skill `qa-testing/webapp-testing`):** alur paste → preview → pilih kualitas → progress → download, dengan API yang di-mock. Ditambah 1 smoke test memakai link asli (dijalankan manual/nightly).
- Pipeline: `npm run lint && npx tsc --noEmit && npm test && npm run build` harus bersih.

**Matriks QA manual**

| Platform | Video HD | Audio MP3 | Android Chrome | iPhone Safari | Desktop |
|---|---|---|---|---|---|
| YouTube (biasa + Shorts) | ☐ 1080p ☐ 4K | ☐ | ☐ | ☐ | ☐ |
| TikTok (tanpa watermark) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Instagram Reels | ☐ | ☐ | ☐ | ☐ | ☐ |
| Facebook / fb.watch | ☐ | ☐ | ☐ | ☐ | ☐ |
| X/Twitter | ☐ | ☐ | ☐ | ☐ | ☐ |

**Checklist kualitas file** (cek dengan `ffprobe`)
- [ ] Resolusi sesuai preset, dan audio ada serta sinkron.
- [ ] Preset `best-compatible` = H.264 + AAC dan bisa diputar di galeri iPhone & Android.
- [ ] Tidak ada re-encode video (bitrate setara sumber).
- [ ] Nama file sesuai judul dan aman (tanpa karakter ilegal).

**Definition of Done (MVP)**
- [ ] 5 platform utama berhasil download HD + audio dari link publik.
- [ ] Tidak ada login di mana pun.
- [ ] Semua state UI (loading, error, sukses, kosong) ada dan rapi di 375 px sampai 1440 px.
- [ ] Rate limit, validasi URL, batas ukuran, dan cleanup berjalan.
- [ ] Lint, typecheck, test, dan build bersih. Lighthouse mobile ≥ 90.
- [ ] Ter-deploy di VPS dengan HTTPS dan auto-update yt-dlp.

---

## 12. Peta Skill dari `D:\SKILL AI`

| Fase | Skill | Dipakai untuk |
|---|---|---|
| Plan | `SKILL CODING/skills/00-core/implementation-planning.md`, `writing-plans/` | Struktur plan, task kecil, dan bukti selesai |
| 0, 5 | `ui-ux-pro-max/.agents/skills/ui-ux-pro-max` (`search.py --design-system --persist`, `--domain ux`, `--stack nextjs`) | Design system, token, UX rules, best practice Next.js |
| 0, 3 | `SKILL CODING/skills/ui-ux-design/dark-mode-premium-ui.md`, `glassmorphism-ui.md` | Arah visual dark premium (glass hanya di header/overlay) |
| 3 | `SKILL CODING/skills/frontend-development/nextjs-website-skill.md`, `react-ui-development.md`, `tailwind-css-design-skill.md`, `frontend-design.md` | Arsitektur App Router, pemisahan komponen/hook/service |
| 3, 5 | `SKILL CODING/skills/frontend-development/vercel-react-best-practices` | Performa React (rerender, bundle, Suspense) |
| 3 | `SKILL CODING/skills/ui-ux-design/ux-writing.md` | Copy tombol, error, empty state |
| 5 | `SKILL CODING/skills/ui-ux-design/impeccable` (`audit`, `polish`, `harden`, `animate`) | Review dan polish UI akhir |
| 5 | `SKILL CODING/skills/frontend-development/accessibility-engineer.md` | WCAG AA |
| 1, 2 | `SKILL CODING/skills/backend-development/nodejs-developer.md`, `api-developer.md` | Route handler, child process, streaming |
| 4 | `SKILL CODING/skills/cyber-security/application-security-engineer.md` | SSRF, injection, rate limit |
| 6 | `SKILL CODING/skills/devops-infrastructure/docker-engineer.md`, `deployment-workflow.md`, `linux-engineer.md` | Docker, VPS, reverse proxy |
| 11 | `SKILL CODING/skills/qa-testing/webapp-testing`, `qa-engineer.md` | E2E dan QA matrix |

---

## 13. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Platform mengubah sistemnya | Download gagal mendadak | Update yt-dlp otomatis, pantau error rate per platform di log, dan tampilkan pesan `BLOCKED_BY_PLATFORM` yang jujur. |
| YouTube memblokir IP VPS ("not a bot") | YouTube tidak bisa dipakai | Deno terpasang, update yt-dlp, opsi `YTDLP_PROXY` (proxy residensial). **Untuk pemakaian pribadi**, self-host di PC/server rumah (IP residensial) paling stabil. |
| IG/FB minta login | Sebagian konten gagal | MVP hanya untuk konten publik. Cookies server opsional dengan akun cadangan (risiko banned). |
| Bandwidth/disk VPS | Biaya naik, server penuh | Batas ukuran/durasi, TTL file, concurrency limit, dan cek kuota bandwidth VPS. |
| Abuse/spam | Server lambat | Rate limit per IP + Turnstile + antrean. |
| Hak cipta / ToS platform | Risiko hukum jika dipublikasikan luas | Halaman disclaimer: "Hanya untuk konten milik sendiri atau yang diizinkan". Tidak menyimpan/menghosting ulang video. Pertimbangkan lebih lanjut sebelum dipasang iklan atau dibuka untuk publik luas. |

---

## 14. Urutan Kerja yang Disarankan

1. **Fase 0 → 1** dulu dan pastikan `/api/info` benar untuk 5 platform. Ini fondasi semuanya.
2. **Fase 2** sampai file YouTube 1080p/4K hasil merge terverifikasi dengan `ffprobe`.
3. **Fase 3** UI lengkap dengan semua state.
4. **Fase 4** hardening sebelum online.
5. **Fase 5** polish + PWA share target.
6. **Fase 6** deploy.
7. Fase 7 sesuai kebutuhan (APK, direct stream, carousel IG).

---

## 15. Status Implementasi — 13 Oktober 2026

Kode aplikasi: folder `savelink/` (repo: https://github.com/Rizkymema/Save-VIdeo). Cara menjalankan: `savelink/README.md`; deploy: `savelink/DEPLOY.md`.

### 15.1 Bukti verifikasi

| Pemeriksaan | Hasil |
|---|---|
| `npm run lint` · `tsc --noEmit` · `next build` | ✅ bersih (28 halaman statis + 6 API route dinamis) |
| Unit test (Vitest) | ✅ **179/179** — parser format (fixture asli 7 platform), error mapping, validasi URL & anti-SSRF, progress, Range, rate limit, nama file, i18n |
| E2E (Playwright, desktop + mobile) | ✅ **22/22** — alur paste→preview→progress→batal/selesai→riwayat, error + aksi pemulihan, Share Target, tema, ganti bahasa, **axe WCAG 2.1 AA tanpa pelanggaran** |
| Smoke test nyata (unduh + ffprobe) | ✅ YouTube Shorts 720p H.264+AAC · TikTok 576p H.264 tanpa watermark + M4A (AAC) · X 720p H.264+AAC · Instagram Reel 720p · Facebook HD · YouTube→MP3 · **4K VP9 3840×2160 60fps + AAC** (potongan 6 detik) |
| Akurasi pilihan kualitas | ✅ Pilihan format yt-dlp asli = prediksi UI untuk semua preset (Terbaik `299+140` H.264 1080p60, 4K `315+140`, 1440p `308+140`, 720p `298+140`, 480p `135+140`); estimasi ukuran Shorts 20,0 MB vs file asli 20,07 MB |
| Hardening (server asli) | ✅ request ke-16/menit → 429 + `Retry-After`; job ke-3 per IP → 429; preset palsu → 422 tanpa menjalankan yt-dlp; body besar → 400; IP privat/`file://`/port/kredensial/`.local` ditolak; batal → proses yt-dlp/ffmpeg mati (4→0) & file `.part` terhapus |
| UI | ✅ 375 px – 1440 px, gelap & terang, ID & EN: tanpa error konsol & tanpa scroll horizontal |
| Lighthouse | Accessibility **100** · Best Practices **100** · SEO **100** · Performance desktop **97** · mobile **72** (CPU dikalibrasi) / 49 (default). Lighthouse memperingatkan CPU laptop ini lebih lambat dari asumsinya; FCP nyata di browser ±200 ms. **Ukur ulang dengan PageSpeed Insights setelah deploy.** |

### 15.2 Status per fase

| Fase | Status | Catatan |
|---|---|---|
| 0 — Setup & design system | ✅ | yt-dlp 2026.08.19 (+ yt-dlp-ejs, **curl_cffi**), ffmpeg 8.1.1, Deno 2.9.7, Next.js 16.4 + React 19.3, shadcn/ui (Radix), `design-system/MASTER.md` (+ koreksi kontras) |
| 1 — Engine info | ✅ | 0.1–1.8 selesai; fixture asli YouTube 4K, Shorts, TikTok, IG Reel, IG carousel, Facebook, X |
| 2 — Job, progress, streaming | ✅ | SSE + fallback polling, Range, nama file UTF-8 (RFC 5987), cleanup TTL + sweeper, verifikasi ffprobe |
| 3 — UI utama | ✅ | Semua state (skeleton, preview, kualitas, progress+stepper, siap, error+aksi, batal, riwayat) |
| 4 — Hardening | ✅ | Turnstile opsional (aktif bila env diisi), log JSON tanpa URL lengkap |
| 5 — Polish, SEO, PWA | ✅ | Halaman per platform ID/EN, metadata + hreflang + JSON-LD + sitemap + OG image, PWA + Share Target + offline page. Target Lighthouse mobile ≥ 90 belum bisa dibuktikan di laptop ini (lihat 15.1) |
| 6 — Deploy | 🟡 siap | **Dua opsi**: (A) VPS Docker Compose + Caddy, (B) atas permintaan: **UI di Vercel** + mesin download di Render/Railway/VPS (mode hybrid: `NEXT_PUBLIC_API_BASE` + CORS via `src/proxy.ts`). Dockerfile (yt-dlp resmi + ffmpeg + Deno + tini), docker-compose + Caddy (HTTPS), contoh Nginx, auto-update yt-dlp, healthcheck, alert webhook, CI GitHub Actions, `DEPLOY.md`. **Belum dijalankan**: butuh VPS + domain kamu; Docker tidak terpasang di laptop ini sehingga image belum di-build lokal (semua image/binary yang dirujuk sudah dicek tersedia) |
| 7 — Lanjutan | 🟡 sebagian | ✅ i18n ID/EN, carousel Instagram, Share Target, panduan APK TWA (butuh domain HTTPS). ⏭️ Belum: direct stream, subtitle/trim/GIF, Redis/BullMQ (tidak diperlukan untuk 1 VPS) |

### 15.3 Perubahan dari rencana (dan alasannya)

- **Next.js 16.4 + Cache Components**: `export const runtime/dynamic` tidak diizinkan → GET route memakai `await connection()`.
- **Tema** memakai skrip inline di `<head>` (rekomendasi docs Next 16) menggantikan `next-themes` → tanpa kedipan & tanpa warning React.
- **Halaman platform** memakai rute statis per platform (bukan `[platform]`) agar path tak dikenal mendapat 404 asli, bukan "soft 404".
- **FAQ** memakai `<details>` native (tanpa JavaScript) menggantikan accordion Radix; komponen shadcn yang tidak terpakai (input, card, progress, badge, accordion) dihapus.
- **Performa**: animasi via `LazyMotion` (dimuat setelah halaman tampil), prefetch link sekunder dimatikan, font mono tidak di-preload → desktop 81→97.
- **TikTok** butuh `curl_cffi` (impersonation browser) — ditambahkan ke instruksi setup; binary resmi yt-dlp di Docker sudah menyertakannya. Preset M4A memakai trek AAC dari video bila audio terpisah berformat MP3 (tanpa transcode).
- **Service worker** tidak menyentuh `/api/` (unduhan file besar langsung ke jaringan) — ditemukan lewat E2E.
- **Vercel**: sesuai permintaan, UI bisa di-deploy di Vercel (terhubung GitHub). Mesin download tetap butuh server Docker (tanpa yt-dlp/ffmpeg, batas durasi function, job di memori, IP AWS sering diblokir YouTube) → ditambahkan mode hybrid `NEXT_PUBLIC_API_BASE` + `CORS_ORIGINS`; tanpa backend, UI menampilkan pesan "mesin download belum aktif".
- **Tambahan**: kode error `FORMAT_UNAVAILABLE`/`VERIFICATION_FAILED`, detail `no_audio` (video bisu + MP3) & `network`; endpoint `GET/DELETE /api/jobs/:id`; dukungan HTTP Range; alert webhook error rate; script `smoke`, `screenshots`, `icons`, `start:standalone`.

### 15.4 Risiko yang masih ada

- YouTube dapat memblokir IP VPS ("not a bot") → update yt-dlp, `YTDLP_PROXY` (proxy residensial), atau server rumah.
- Instagram membatasi sebagian konten tanpa login (`LOGIN_REQUIRED`).
- Skor performa mobile final harus diukur di server produksi (PageSpeed Insights).
