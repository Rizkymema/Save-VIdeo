import { DETAIL_MESSAGES, ERROR_MESSAGES } from "@/constants/messages";
import type { ApiErrorCode, ApiErrorDetail } from "@/types/video";

export interface FaqItem {
  q: string;
  a: string;
}

export interface PlatformCopy {
  /** <title> halaman */
  title: string;
  description: string;
  h1: string;
  highlight: string;
  subtitle: string;
  placeholder: string;
  faq: FaqItem[];
}

export interface LegalSection {
  h: string;
  p: string[];
}

export const id = {
  meta: {
    siteName: "SaveLink",
    title: "SaveLink — Download Video dari Link YouTube, TikTok, Instagram & Facebook",
    shortTitle: "Download Video dari Link",
    description:
      "Download video YouTube, TikTok tanpa watermark, Instagram, Facebook, X dan 1000+ situs lain. Kualitas HD sampai 4K atau MP3 — gratis, tanpa login.",
    keywords: [
      "download video",
      "video downloader",
      "download tiktok tanpa watermark",
      "download video youtube",
      "download reels instagram",
      "download video facebook",
      "youtube to mp3",
    ],
  },
  nav: {
    skip: "Lewati ke konten utama",
    home: "Beranda SaveLink",
    how: "Cara pakai",
    faq: "FAQ",
    theme: "Ganti tema terang/gelap",
    language: "Ganti bahasa",
    languageShort: "EN",
    languageName: "English",
  },
  hero: {
    eyebrow: "Gratis · Tanpa login · Tanpa watermark",
    title: "Download video dari",
    highlight: "link apa pun",
    subtitle: "YouTube, TikTok, Instagram, Facebook, X, dan 1000+ situs lain. Kualitas asli sampai 4K — atau ambil audionya saja.",
  },
  input: {
    label: "Link video",
    placeholder: "Tempel link video…",
    paste: "Tempel",
    pasteAria: "Tempel link dari clipboard",
    clear: "Hapus link",
    submit: "Ambil Video",
    submitting: "Memproses…",
    detected: "Link {platform} terdeteksi",
    hint: "Tip: di aplikasi, ketuk Bagikan → Salin link, lalu tempel di sini.",
    shared: "Link dari aplikasi lain sudah ditempel.",
    pasteDenied: "Browser menolak akses clipboard. Tempel manual: tekan lama kolom lalu pilih Tempel (atau Ctrl+V).",
    invalid: {
      empty: "Tempel link videonya dulu.",
      invalid: "Itu bukan link yang valid. Salin ulang dari tombol Bagikan → Salin link.",
      not_video: "Link ini mengarah ke profil atau playlist. Buka videonya, lalu salin link-nya.",
    },
  },
  platforms: {
    label: "Didukung",
    more: "+1000 situs",
    other: "Situs lain",
  },
  preview: {
    loading: "Mengambil info video…",
    by: "oleh {name}",
    duration: "Durasi {time}",
    multi: "Postingan ini berisi {count} video — pilih yang ingin diunduh:",
    item: "Video {n}",
    thumbAlt: "Thumbnail: {title}",
  },
  quality: {
    video: "Video",
    audio: "Audio saja",
    best: "Terbaik",
    recommended: "Direkomendasikan",
    approx: "≈ {size}",
    tiers: { uhd: "Ultra HD", qhd: "Quad HD", fhd: "Full HD", hd: "HD", sd: "SD" },
    codec: {
      h264: "H.264 · diputar di semua perangkat",
      h265: "HEVC · didukung HP modern",
      vp9: "VP9 · mungkin tidak terputar di galeri iPhone",
      av1: "AV1 · butuh pemutar modern (mis. VLC)",
      other: "Format asli",
    },
    hdr: "HDR",
    audioM4a: "Audio asli, tanpa kompresi ulang",
    audioMp3: "Paling kompatibel",
    downloadAria: "Download {label} ({ext})",
    mergeNote: "Video & audio digabung tanpa kompresi ulang — kualitas tetap asli.",
    busy: "Tunggu unduhan yang sedang berjalan selesai.",
    tooLarge: "Terlalu besar untuk server ini (maks {maxMb} MB)",
  },
  progress: {
    title: "Memproses {label}",
    queued: "Dalam antrean — posisi {n}",
    queuedShort: "Dalam antrean…",
    starting: "Menyiapkan unduhan…",
    video: "Mengunduh video",
    audio: "Mengunduh audio",
    file: "Mengunduh",
    merging: "Menggabungkan video & audio",
    converting: "Mengonversi audio",
    speed: "{speed}/dtk",
    eta: "sisa {time}",
    cancel: "Batalkan",
    canceled: "Unduhan dibatalkan.",
    preparing: "Menyiapkan file di server…",
    preparingHint: "File langsung terunduh begitu siap. Video panjang bisa 1–3 menit — jangan tutup halaman ini.",
    elapsed: "{time} berlalu",
    steps: { queued: "Antre", download: "Unduh", process: "Proses", done: "Selesai" },
  },
  ready: {
    title: "File siap!",
    subtitle: "Unduhan dimulai otomatis. Kalau tidak, ketuk Simpan file.",
    save: "Simpan file",
    another: "Kualitas lain",
    newLink: "Video lain",
    expires: "File dihapus otomatis dari server dalam {minutes} menit.",
    ios: "iPhone/iPad: file masuk ke app Files → buka → Bagikan → Simpan Video.",
    toast: "Selesai: {name}",
    directTitle: "Unduhan dimulai!",
    directSubtitle: "Cek bilah unduhan browser atau folder Download di perangkatmu.",
    again: "Unduh lagi",
    directNote: "File tidak disimpan di server — langsung dikirim ke perangkatmu.",
  },
  errors: {
    title: "Tidak bisa diproses",
    retry: "Coba lagi",
    retryIn: "Coba lagi ({s})",
    otherQuality: "Pilih kualitas lain",
    editLink: "Periksa link",
    codes: ERROR_MESSAGES as Record<ApiErrorCode, string>,
    details: DETAIL_MESSAGES as Partial<Record<ApiErrorDetail, string>>,
  },
  history: {
    title: "Riwayat",
    subtitle: "Tersimpan di perangkat ini saja",
    clear: "Hapus semua",
    remove: "Hapus {title} dari riwayat",
    again: "Ambil lagi",
    justNow: "baru saja",
  },
  how: {
    title: "Cara pakai",
    subtitle: "Tiga langkah, tanpa aplikasi tambahan.",
    steps: [
      { title: "Salin link", body: "Di YouTube, TikTok, Instagram, atau Facebook, ketuk Bagikan → Salin link." },
      { title: "Tempel di sini", body: "Tempel di kolom atas. Info video dan pilihan kualitas muncul otomatis." },
      { title: "Pilih & simpan", body: "Pilih resolusi atau MP3 — file langsung tersimpan di perangkatmu." },
    ],
  },
  features: {
    title: "Kenapa SaveLink",
    items: [
      { title: "Kualitas asli sampai 4K", body: "Video dan audio terbaik digabung tanpa kompresi ulang, jadi tidak ada kualitas yang hilang." },
      { title: "TikTok tanpa watermark", body: "Kami memilih versi video tanpa watermark dengan bitrate tertinggi yang tersedia." },
      { title: "Audio MP3 & M4A", body: "Ambil suaranya saja — M4A asli tanpa kompresi ulang, atau MP3 untuk semua pemutar." },
      { title: "Privat & tanpa akun", body: "Tidak perlu login. File dihapus otomatis dari server, riwayat hanya ada di perangkatmu." },
    ],
  },
  faq: {
    title: "Pertanyaan umum",
    items: [
      { q: "Apakah SaveLink gratis?", a: "Ya, gratis dan tanpa daftar akun. Tempel link, pilih kualitas, selesai." },
      {
        q: "Kenapa ada pilihan 4K yang ditandai VP9/AV1?",
        a: "YouTube menyimpan 1440p dan 4K dalam codec VP9 atau AV1. File tetap MP4, tapi galeri bawaan iPhone kadang tidak bisa memutarnya — gunakan VLC, atau pilih opsi \"Terbaik\" (H.264) yang diputar di semua perangkat.",
      },
      { q: "Apakah bisa download dari akun privat?", a: "Tidak. SaveLink hanya bisa mengambil video publik yang bisa ditonton tanpa login." },
      { q: "Di mana file tersimpan di HP?", a: "Android: folder Download. iPhone/iPad: app Files → Unduhan; buka file lalu Bagikan → Simpan Video untuk memindahkan ke Foto." },
      { q: "Apakah video saya disimpan?", a: "Tidak. File hanya ada di server selama proses dan dihapus otomatis paling lama 30 menit kemudian. Riwayat hanya tersimpan di browser kamu." },
      { q: "Ada batas ukuran atau durasi?", a: "Agar server tetap cepat untuk semua orang, video dibatasi maksimal 2 jam dan 2 GB per file." },
      {
        q: "Bolehkah mengunduh video orang lain?",
        a: "Unduh hanya konten milik sendiri atau yang kamu punya izin untuk menyimpannya. Hormati hak cipta kreator dan aturan masing-masing platform.",
      },
    ],
  },
  footer: {
    tagline: "Download video dari link, kualitas asli, tanpa login.",
    disclaimer:
      "Hanya untuk konten milik sendiri atau yang kamu punya izin untuk mengunduhnya. SaveLink tidak menyimpan atau menghosting ulang video, dan tidak berafiliasi dengan platform mana pun.",
    downloaders: "Downloader",
    legal: "Legal",
    terms: "Syarat & Disclaimer",
    privacy: "Privasi",
  },
  platformPages: {
    youtube: {
      title: "Download Video YouTube (HD, 4K, MP3)",
      description: "Download video dan Shorts YouTube dalam kualitas HD sampai 4K, atau ubah ke MP3. Gratis, cepat, tanpa login.",
      h1: "Download video",
      highlight: "YouTube",
      subtitle: "Video biasa dan Shorts, kualitas asli sampai 4K 60fps, atau audio MP3/M4A.",
      placeholder: "Tempel link YouTube…",
      faq: [
        { q: "Bisa download YouTube Shorts?", a: "Bisa. Tempel link youtube.com/shorts/… seperti video biasa." },
        { q: "Kenapa 1080p lebih kecil dari 4K?", a: "Resolusi lebih tinggi butuh bitrate lebih besar. Opsi \"Terbaik\" memakai H.264 1080p yang paling kompatibel." },
      ],
    },
    tiktok: {
      title: "Download Video TikTok Tanpa Watermark",
      description: "Simpan video TikTok tanpa watermark dalam kualitas terbaik, atau ambil audionya sebagai MP3. Gratis, tanpa login.",
      h1: "Download TikTok",
      highlight: "tanpa watermark",
      subtitle: "Versi tanpa watermark dengan bitrate tertinggi yang tersedia, plus opsi MP3.",
      placeholder: "Tempel link TikTok…",
      faq: [
        { q: "Apakah benar tanpa watermark?", a: "Ya. Kami memprioritaskan versi video tanpa watermark yang disediakan TikTok." },
        { q: "Link pendek vt.tiktok.com bisa?", a: "Bisa. Link pendek dari tombol Bagikan → Salin link langsung dikenali." },
      ],
    },
    instagram: {
      title: "Download Reels & Video Instagram",
      description: "Download Reels, video, dan postingan multi-video Instagram dari akun publik. Kualitas asli, tanpa login.",
      h1: "Download Reels",
      highlight: "Instagram",
      subtitle: "Reels, video feed, dan postingan berisi beberapa video — dari akun publik.",
      placeholder: "Tempel link Instagram…",
      faq: [
        { q: "Bisa dari akun privat?", a: "Tidak. Hanya konten dari akun publik yang bisa diunduh." },
        { q: "Postingan berisi beberapa video?", a: "Bisa. Kamu akan diminta memilih video mana yang ingin diunduh." },
      ],
    },
    facebook: {
      title: "Download Video Facebook (HD)",
      description: "Download video dan Reels Facebook publik dalam kualitas HD. Mendukung link fb.watch. Gratis, tanpa login.",
      h1: "Download video",
      highlight: "Facebook",
      subtitle: "Video, Reels, dan link fb.watch dari halaman atau profil publik — kualitas HD.",
      placeholder: "Tempel link Facebook…",
      faq: [
        { q: "Video dari grup privat bisa?", a: "Tidak. Video harus bisa ditonton publik tanpa login." },
        { q: "Kenapa hanya ada SD?", a: "Beberapa video memang hanya diunggah dalam kualitas SD oleh pemiliknya." },
      ],
    },
    twitter: {
      title: "Download Video X (Twitter)",
      description: "Download video dari postingan X (Twitter) publik dalam kualitas terbaik, atau ambil audionya. Gratis, tanpa login.",
      h1: "Download video",
      highlight: "X (Twitter)",
      subtitle: "Video dari postingan publik di x.com atau twitter.com, kualitas terbaik yang tersedia.",
      placeholder: "Tempel link postingan X…",
      faq: [
        { q: "Link x.com dan twitter.com sama-sama bisa?", a: "Bisa, keduanya dikenali." },
        { q: "Postingan dengan beberapa video?", a: "Bisa. Kamu akan diminta memilih video yang ingin diunduh." },
      ],
    },
  } satisfies Record<string, PlatformCopy>,
  legal: {
    updated: "Terakhir diperbarui: 13 Oktober 2026",
    back: "Kembali ke beranda",
    terms: {
      title: "Syarat Penggunaan & Disclaimer",
      intro: "Dengan memakai SaveLink, kamu menyetujui ketentuan berikut.",
      sections: [
        {
          h: "Penggunaan yang diizinkan",
          p: [
            "SaveLink adalah alat bantu untuk menyimpan salinan pribadi video yang kamu miliki atau yang kamu punya izin untuk mengunduhnya.",
            "Jangan gunakan SaveLink untuk melanggar hak cipta, menyebarkan ulang karya orang lain tanpa izin, atau melanggar ketentuan layanan platform sumber.",
          ],
        },
        {
          h: "Tanggung jawab pengguna",
          p: [
            "Kamu bertanggung jawab penuh atas konten yang kamu unduh dan bagaimana kamu menggunakannya.",
            "SaveLink tidak berafiliasi dengan YouTube, TikTok, Instagram, Facebook, X, atau platform lain mana pun.",
          ],
        },
        {
          h: "Tanpa jaminan",
          p: [
            "Layanan disediakan apa adanya. Platform dapat mengubah sistemnya kapan saja sehingga sebagian video mungkin tidak bisa diproses.",
            "Untuk menjaga server tetap cepat, kami menerapkan batas ukuran, durasi, dan jumlah permintaan per pengguna.",
          ],
        },
        {
          h: "Penghapusan konten",
          p: ["Kami tidak menyimpan video. File sementara dihapus otomatis paling lama 30 menit setelah diproses."],
        },
      ] satisfies LegalSection[],
    },
    privacy: {
      title: "Kebijakan Privasi",
      intro: "SaveLink dirancang agar tidak perlu tahu siapa kamu.",
      sections: [
        { h: "Tanpa akun", p: ["Tidak ada pendaftaran, login, atau profil pengguna."] },
        {
          h: "Data yang diproses",
          p: [
            "Link yang kamu tempel dikirim ke server hanya untuk mengambil info dan file video, lalu dibuang.",
            "Alamat IP dipakai sementara di memori untuk membatasi penyalahgunaan (rate limit) dan tidak disimpan permanen.",
            "File video sementara dihapus otomatis paling lama 30 menit setelah diproses.",
          ],
        },
        {
          h: "Penyimpanan di perangkatmu",
          p: ["Riwayat unduhan dan pilihan tema disimpan di browser kamu (localStorage) dan bisa dihapus kapan saja dari halaman utama."],
        },
        {
          h: "Pihak ketiga",
          p: [
            "Thumbnail video dimuat melalui server kami dari CDN platform sumber.",
            "Bila verifikasi anti-bot Cloudflare Turnstile diaktifkan, Cloudflare memproses data teknis browser sesuai kebijakan privasinya.",
          ],
        },
      ] satisfies LegalSection[],
    },
  },
  offline: {
    title: "Kamu sedang offline",
    body: "SaveLink butuh internet untuk mengambil video. Periksa koneksi lalu coba lagi.",
    retry: "Coba lagi",
  },
  notFound: {
    title: "Halaman tidak ditemukan",
    body: "Link yang kamu buka tidak ada. Kembali ke beranda untuk mengunduh video.",
    home: "Ke beranda",
  },
};

export type Dictionary = typeof id;
export type PlatformSlug = keyof Dictionary["platformPages"];
