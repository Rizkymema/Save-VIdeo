/** Nama file aman dari judul video (lintas Windows/macOS/Android/iOS). */
export function safeFileBase(title: string, maxLength = 120): string {
  const cleaned = title
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, "");
  const base = Array.from(cleaned).slice(0, maxLength).join("").trim().replace(/[.\s]+$/g, "");
  // Nama terlarang di Windows.
  if (!base || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(base)) return "video";
  return base;
}

/** "Judul Video (1080p).mp4" untuk video, "Judul Video.mp3" untuk audio. */
export function downloadFileName(title: string, ext: string, opts: { audio: boolean; qualityLabel?: string }): string {
  const base = safeFileBase(title);
  const suffix = !opts.audio && opts.qualityLabel && opts.qualityLabel !== "Auto" ? ` (${opts.qualityLabel})` : "";
  return `${base}${suffix}.${ext}`;
}

function asciiFallback(name: string): string {
  const ascii = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_")
    .replace(/_+/g, "_");
  return ascii.trim() || "video";
}

/** RFC 5987/6266: `filename` ASCII + `filename*` UTF-8 agar judul ber-emoji/Unicode tetap aman. */
export function contentDisposition(fileName: string): string {
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${asciiFallback(fileName)}"; filename*=UTF-8''${encoded}`;
}

export function contentTypeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case "mp4":
      return "video/mp4";
    case "m4a":
      return "audio/mp4";
    case "mp3":
      return "audio/mpeg";
    case "webm":
      return "video/webm";
    case "mkv":
      return "video/x-matroska";
    case "mov":
      return "video/quicktime";
    case "ogg":
    case "opus":
      return "audio/ogg";
    default:
      return "application/octet-stream";
  }
}
