# Deploy SaveLink

## 0. Pilih cara deploy

SaveLink terdiri dari **UI** (halaman web) dan **mesin download** (yt-dlp + ffmpeg + Deno yang berjalan lama dan menyimpan job di memori).

| Opsi | UI | Mesin download | Cocok untuk |
|---|---|---|---|
| **A. VPS (Docker Compose)** — bagian 1–10 | VPS | VPS | Paling stabil & murah untuk dipakai rutin |
| **B. Vercel + backend Docker** — bagian 11 | Vercel (otomatis dari GitHub) | Render / Railway / VPS (otomatis dari GitHub) | Sudah punya Vercel & tidak mau mengurus server |

> **Vercel saja tidak cukup.** Function Vercel tidak punya yt-dlp/ffmpeg, dibatasi durasinya (merge video HD bisa berjalan beberapa menit), request progress & unduhan bisa jatuh ke instance berbeda (job tersimpan di memori), dan IP Vercel/AWS sangat sering diblokir YouTube. Bila UI di Vercel dipakai tanpa backend, pengguna akan melihat pesan *"Mesin download di server ini belum aktif"*.

---

# Opsi A — VPS dengan Docker Compose

Panduan dari VPS kosong sampai online dengan HTTPS. Waktu ±20 menit.

## 1. Kebutuhan

| Item | Rekomendasi |
|---|---|
| VPS | Ubuntu 22.04/24.04, **min 2 vCPU / 4 GB RAM / 40 GB SSD**, lokasi Singapura/Jakarta |
| Bandwidth | Besar/unmetered — setiap unduhan video lewat server (1080p ±250 MB, 4K ±1,3 GB) |
| Domain | Record DNS **A** (dan **AAAA** bila ada IPv6) mengarah ke IP VPS |

> Kenapa bukan Vercel/serverless: butuh ffmpeg + yt-dlp, proses merge bisa beberapa menit, job disimpan di memori, dan IP serverless cepat diblokir YouTube.

## 2. Siapkan server

```bash
# Docker + Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# Firewall: SSH, HTTP, HTTPS (termasuk HTTP/3)
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp
sudo ufw enable

# Update keamanan otomatis
sudo apt-get install -y unattended-upgrades
```

## 3. Ambil kode & konfigurasi

```bash
git clone https://github.com/Rizkymema/Save-VIdeo.git savelink
cd savelink
cp .env.example .env
nano .env
```

Isi minimal di `.env`:

```env
DOMAIN=savelink.domainkamu.com
NEXT_PUBLIC_SITE_URL=https://savelink.domainkamu.com
```

Baris lokasi tool (`YTDLP_PATH`, `YTDLP_JS_RUNTIMES`, `YTDLP_AUTO_UPDATE`, …) **biarkan ber-komentar** — image Docker sudah mengaturnya (yt-dlp resmi + Deno + ffmpeg, auto-update aktif).

## 4. Jalankan

```bash
docker compose up -d --build
docker compose ps            # tunggu status app "healthy"
curl -s https://savelink.domainkamu.com/api/health
```

`/api/health` harus menampilkan `"ok": true` beserta versi `ytdlp`, `ffmpeg`, `deno`. Caddy otomatis mengambil sertifikat HTTPS Let's Encrypt saat pertama diakses.

Uji cepat dari laptop (ganti URL server):

```bash
npm run smoke -- "https://youtu.be/jNQXAC9IVRw" best-compatible https://savelink.domainkamu.com
```

## 5. Update aplikasi

```bash
cd ~/savelink && git pull && docker compose up -d --build
```

## 6. yt-dlp selalu terbaru

Platform sering berubah — yt-dlp yang usang adalah penyebab utama download gagal.

- **Otomatis (sudah aktif):** container menjalankan `yt-dlp -U` saat start lalu tiap 24 jam (hanya saat tidak ada unduhan berjalan). Hasilnya terlihat di `/api/health` → `ytdlpUpdate`.
- **Rebuild mingguan (disarankan)** agar ffmpeg/Deno/OS ikut diperbarui — `crontab -e`:
  ```cron
  0 4 * * 1 cd /home/USERKAMU/savelink && docker compose build --pull app && docker compose up -d app >> /var/log/savelink-rebuild.log 2>&1
  ```

## 7. Monitoring

| Apa | Cara |
|---|---|
| Uptime | Daftarkan `https://domainkamu/api/health` di UptimeRobot / Better Stack (interval 5 menit, keyword `"ok":true`). |
| Error rate per platform | Isi `ALERT_WEBHOOK_URL` (webhook Discord/Slack). Server mengirim alert bila ≥ 50% permintaan satu platform gagal dalam 30 menit (min. 10 sampel). |
| Log | `docker compose logs -f app` — satu baris JSON per event (`info.failed`, `job.ready`, …), tanpa URL lengkap user. |
| Kesehatan container | Docker `HEALTHCHECK` memanggil `/api/health` tiap 30 detik. |

## 8. Opsional

### Cloudflare Turnstile (anti-bot tanpa login)
1. Buat widget di dashboard Cloudflare → Turnstile (mode *Invisible* / *Managed*).
2. Isi `NEXT_PUBLIC_TURNSTILE_SITE_KEY` dan `TURNSTILE_SECRET_KEY` di `.env`.
3. `docker compose up -d --build` (site key di-inline saat build, jadi wajib rebuild).

### Di belakang Cloudflare proxy
- Set `TRUST_PROXY_HEADER=cf-connecting-ip` agar rate limit memakai IP asli user.
- Untuk unduhan file besar & SSE yang lama, paling sederhana pakai **DNS only** (awan abu-abu).

### YouTube memblokir IP VPS ("Sign in to confirm you're not a bot")
- Pastikan yt-dlp terbaru (`/api/health`).
- Isi `YTDLP_PROXY` dengan proxy residensial, atau jalankan SaveLink di server rumah (IP residensial).

### Nginx sebagai pengganti Caddy
Pakai [`deploy/nginx.conf.example`](deploy/nginx.conf.example) (sudah berisi `proxy_buffering off` untuk SSE & file besar), jalankan app dengan port `127.0.0.1:3000:3000`, set `TRUST_PROXY_HEADER=x-real-ip`, dan ambil sertifikat dengan `certbot --nginx`.

## 9. APK Android (TWA)

SaveLink sudah PWA (manifest + service worker + Share Target), jadi bisa dibungkus menjadi APK tanpa menulis ulang aplikasi:

```bash
npm i -g @bubblewrap/cli          # butuh JDK 17 & Android SDK (bubblewrap bisa memasangnya)
bubblewrap init --manifest https://savelink.domainkamu.com/manifest.webmanifest
bubblewrap build                  # → app-release-signed.apk
```

Lalu buat `public/.well-known/assetlinks.json` berisi package name & SHA-256 fingerprint dari `bubblewrap` (perintah `bubblewrap fingerprint`), deploy ulang, dan APK akan tampil layar penuh tanpa address bar. Karena ada `share_target`, aplikasi muncul di menu **Bagikan** Android — link dari TikTok/IG langsung diproses.

---

# Opsi B — UI di Vercel + mesin download di Render/Railway

Repo GitHub yang sama dipakai dua kali: Vercel membangun UI, layanan Docker (Render/Railway) membangun `Dockerfile` untuk mesin download. Setiap `git push` → keduanya deploy otomatis.

## 11.1 Backend (mesin download)

**Render** (render.com): *New → Web Service* → hubungkan repo GitHub → *Runtime: Docker* (Dockerfile terdeteksi otomatis).
- *Health Check Path*: `/api/health`
- *Environment*: `CORS_ORIGINS=https://NAMA-PROJECT.vercel.app` (tambahkan domain custom bila ada, dipisah koma)
- Paket gratis (512 MB, tidur saat sepi, bangun ±1 menit) cukup untuk mencoba video pendek; untuk pemakaian rutin pilih paket berbayar ≥ 2 GB RAM.

**Railway** (railway.app): *New Project → Deploy from GitHub repo* → Dockerfile terdeteksi otomatis → *Variables*: `CORS_ORIGINS=https://NAMA-PROJECT.vercel.app` → *Settings → Networking → Generate Domain*.

Setelah online, buka `https://ALAMAT-BACKEND/api/health` → harus `"ok": true`.

> Rate limit memakai IP user dari header proxy platform. Bila semua pengguna tampak berbagi satu batas, ubah `TRUST_PROXY_HEADER` (`x-real-ip` atau `cf-connecting-ip`) sesuai header yang dikirim platform.

## 11.2 Frontend di Vercel

1. Vercel → *Add New → Project* → impor repo `Save-VIdeo` (framework Next.js terdeteksi otomatis, tanpa pengaturan build tambahan).
2. *Settings → Environment Variables*:
   - `NEXT_PUBLIC_API_BASE` = `https://ALAMAT-BACKEND` (tanpa `/` di akhir)
   - `NEXT_PUBLIC_SITE_URL` = domain custom (opsional — tanpa ini otomatis memakai domain produksi Vercel)
   - (opsional) `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — secret key-nya dipasang di backend
3. *Deployments → Redeploy* (variabel `NEXT_PUBLIC_*` di-inline saat build, jadi wajib build ulang).

Cek: buka situs Vercel → tempel link → info video muncul. Di DevTools → Network, request `api/info` harus mengarah ke alamat backend.

## 12. Checklist go-live

- [ ] `/api/health` → `ok: true` (yt-dlp, ffmpeg, deno terdeteksi)
- [ ] Smoke test YouTube, TikTok, Instagram, Facebook, X dari domain publik
- [ ] HTTPS valid, `www.` diarahkan ke domain utama
- [ ] Uptime monitor & (opsional) `ALERT_WEBHOOK_URL` aktif
- [ ] Cron rebuild mingguan terpasang
- [ ] PageSpeed Insights (https://pagespeed.web.dev) dijalankan ke domain publik
- [ ] (Opsi B) `NEXT_PUBLIC_API_BASE` di Vercel & `CORS_ORIGINS` di backend sudah cocok, lalu Vercel di-redeploy
