import type { ApiErrorCode, ApiErrorDetail } from "@/types/video";

/** Pesan error default (Bahasa Indonesia) yang dikirim API. UI bisa menerjemahkan ulang dari `code`. */
export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  INVALID_URL: "Link-nya sepertinya tidak lengkap. Salin ulang dari tombol Bagikan → Salin link.",
  UNSUPPORTED: "Situs ini belum didukung.",
  PRIVATE: "Video ini privat, jadi tidak bisa diunduh.",
  LOGIN_REQUIRED: "Video ini butuh login untuk ditonton, jadi tidak bisa diunduh.",
  AGE_RESTRICTED: "Video ini dibatasi umur oleh platform.",
  GEO_BLOCKED: "Video ini tidak tersedia di wilayah server kami.",
  NOT_FOUND: "Video tidak ditemukan atau sudah dihapus.",
  TOO_LONG: "Video terlalu panjang (maks {maxMinutes} menit).",
  TOO_LARGE: "File terlalu besar (maks {maxMb} MB). Coba kualitas lebih rendah.",
  FORMAT_UNAVAILABLE: "Kualitas ini tidak tersedia untuk video ini. Pilih kualitas lain.",
  RATE_LIMITED: "Terlalu banyak permintaan. Coba lagi dalam beberapa detik.",
  BUSY: "Server sedang ramai. Coba lagi dalam beberapa detik.",
  BLOCKED_BY_PLATFORM: "Platform sedang membatasi server kami. Coba lagi nanti.",
  TIMEOUT: "Koneksi ke platform terlalu lama. Coba lagi.",
  VERIFICATION_FAILED: "Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi.",
  UNKNOWN: "Ada kendala saat memproses video. Coba lagi.",
};

export const DETAIL_MESSAGES: Partial<Record<ApiErrorDetail, string>> = {
  live: "Siaran langsung belum bisa diunduh. Coba lagi setelah siarannya selesai.",
  playlist: "Playlist atau channel belum didukung. Tempel link video satu per satu.",
  not_video: "Link ini mengarah ke profil atau playlist, bukan satu video. Buka videonya lalu salin link-nya.",
  no_video: "Tidak ada video di link ini.",
  no_audio: "Video ini tidak punya suara, jadi audionya tidak bisa diambil. Pilih opsi video.",
  drm: "Video ini dilindungi DRM sehingga tidak bisa diunduh.",
  disk: "Penyimpanan server hampir penuh. Coba lagi beberapa menit lagi.",
  dns: "Alamat situs tidak ditemukan. Periksa kembali link-nya.",
  expired: "File sudah kedaluwarsa. Proses ulang videonya.",
  network: "Koneksi terputus. Periksa internet kamu lalu coba lagi.",
  engine: "Mesin download di server ini belum aktif. Coba lagi nanti atau hubungi pemilik situs.",
};

/** Ganti placeholder `{nama}` dengan nilai params; placeholder tanpa nilai dibuang beserta kurungnya. */
export function fillTemplate(template: string, params?: Record<string, string | number>): string {
  const filled = template.replace(/\{(\w+)\}/g, (_, key: string) =>
    params && params[key] !== undefined ? String(params[key]) : "\u0000",
  );
  return filled.replace(/\s*\([^)]*\u0000[^)]*\)/g, "").replace(/\u0000/g, "");
}

export const RETRYABLE_CODES: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>([
  "RATE_LIMITED",
  "BUSY",
  "BLOCKED_BY_PLATFORM",
  "TIMEOUT",
  "VERIFICATION_FAILED",
  "UNKNOWN",
]);
