# Fixture metadata yt-dlp

Folder ini berisi **metadata asli** hasil `yt-dlp -J` untuk unit test aplikasi.
Semua fixture sudah **dipangkas (trimmed)**:

- **Tidak ada file media** yang diunduh (hanya `-J` / dump JSON metadata).
- **Tidak ada URL bertanda tangan (signed URL) / token**: kunci `url`, `fragments`,
  `http_headers`, `manifest_url`, cookies, dan semua kunci lain di luar daftar di bawah dibuang.
- `thumbnail` diganti URL palsu dengan **host yang sama** (`<scheme>://<host>/thumb.jpg`),
  supaya logika berbasis host tetap bisa dites.

Tanggal pengambilan: **2026-10-13** · yt-dlp **2026.08.19** (+ yt-dlp-ejs, runtime JS Deno).

Perintah yang dipakai untuk setiap URL:

```
yt-dlp --ignore-config --no-playlist --ies "default,-generic" --js-runtimes "deno:<path-ke-deno.exe>" --no-warnings -J --playlist-items 1:20 -- "<URL>"
```

Kunci yang dipertahankan:

- Level atas (dan setiap item di `entries`): `_type, id, title, fulltitle, uploader, channel,
  creator, uploader_id, thumbnail, duration, is_live, live_status, webpage_url, extractor_key,
  width, height, resolution, vcodec, acodec, ext, fps, formats, entries`.
- Setiap item `formats`: `format_id, format_note, ext, protocol, vcodec, acodec, width, height,
  resolution, fps, tbr, abr, vbr, filesize, filesize_approx, dynamic_range, has_drm, quality,
  preference, language_preference` (tiga terakhir ditambahkan agar parser bisa meniru urutan prioritas yt-dlp).

Kunci yang memang tidak dikirim yt-dlp tetap **tidak ada** (bukan `null`); nilai `null` asli tetap `null`.
File ditulis UTF-8 dengan `json.dump(..., ensure_ascii=False, indent=1)`.

## Daftar fixture

| File | URL sumber | Diambil | Extractor | Jumlah format | Catatan |
|---|---|---|---|---|---|
| `youtube-4k.json` | https://www.youtube.com/watch?v=aqz-KE-bpKQ | 2026-10-13 | `Youtube` | 53 | Big Buck Bunny 60fps 4K (Blender Foundation). 3840x2160. vp9 & av01 sampai 2160p60, avc1 hanya sampai 1080p60. 12 format audio-only (m4a/opus, termasuk varian `-drc` dan HLS `233`/`234` yang tidak punya kunci `acodec`). 4 storyboard `mhtml` (`sb0`–`sb3`). Tidak ada format gabungan video+audio. |
| `youtube-short.json` | https://www.youtube.com/shorts/YC7pwvv6t78 | 2026-10-13 | `Youtube` | 161 | Shorts vertikal 720x1280 (Space.com). 19 trek audio (dub otomatis + original), `format_id` bersufiks `-N` (mis. `140-18`): 133 audio-only, 24 video-only, 4 storyboard. Ada format 608x1080 dengan `format_note: "480p"`. `webpage_url` dinormalisasi ke `watch?v=`. |
| `instagram-reel.json` | https://www.instagram.com/reel/Chunk8-jurw/ | 2026-10-13 | `Instagram` | 9 | Reel akun resmi @instagram, 720x1280. 6 DASH video-only avc1 + 3 progresif (`0`,`1`,`2`) tanpa `width`/`height`. Semua `acodec: "none"` karena API Instagram melaporkan `has_audio: false` (video tanpa suara). Tidak ada `duration`. |
| `instagram-carousel.json` | https://www.instagram.com/p/BQ0eAlwhDrw/ | 2026-10-13 | `Instagram` | 0 di level atas; 3 entri × 4 = 12 | Post multi-video @instagram. Level atas `_type: "playlist"` dengan 3 `entries` (entri tidak punya kunci `_type`). Tiap entri 640x640, avc1, `acodec: "none"`. |
| `facebook.json` | https://www.facebook.com/NASATechnology/videos/capstone-mission/762326434486859/ | 2026-10-13 | `Facebook` | 2 | Video halaman NASA Technology, durasi 4,36 detik. Hanya format progresif `sd` dan `hd`, tanpa info codec maupun resolusi (`resolution: null`). |
| `tiktok.json` | https://www.tiktok.com/@nba/video/7508215170003488031 | 2026-10-13 | `TikTok` | 12 | Diambil ulang setelah `curl_cffi` dipasang (impersonation). Vertikal 1080x1920. `download` = versi **ber-watermark** (`preference: -2`); format `h264_540p_*` (576x1024, dua bitrate) dan `bytevc1_*` (H.265 sampai 1080p) tanpa watermark. Satu format `audio` MP3 audio-only. |
| `twitter.json` | https://x.com/NASA/status/1491475671058681863 | 2026-10-13 | `Twitter` | 9 | Post @NASA, 1280x720. 3 HLS audio-only (tanpa kunci `acodec`), 3 HLS video-only avc1, 3 progresif `http-*` (tanpa info codec). `id` adalah ID media (`1491441845964001288`), **bukan** ID status. |

## Fixture error (`errors/`)

Berisi stderr yt-dlp dari target yang gagal, untuk menguji pemetaan error.

> TikTok sempat gagal (`Unexpected response from webpage request`) karena `curl_cffi` belum terpasang;
> setelah `pip install "yt-dlp[default,curl-cffi]"` berhasil → lihat `tiktok.json`. Pesan itu kini dipetakan ke `BLOCKED_BY_PLATFORM`.

| File | URL | Keterangan |
|---|---|---|
| `errors/instagram-empty-media.txt` | https://www.instagram.com/reel/BkfuX9UB-eK/ | Tambahan (bukan target utama): `Instagram sent an empty media response` (konten butuh login/cookies). Berguna untuk memetakan error "perlu login". |

## Catatan

- Fixture adalah *snapshot*: data aslinya di platform bisa berubah atau dihapus sewaktu-waktu.
- Host thumbnail Instagram/Facebook adalah edge CDN regional (`*.fna.fbcdn.net`), YouTube `i.ytimg.com`, X `pbs.twimg.com`.
