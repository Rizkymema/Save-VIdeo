import { ImageResponse } from "next/og";

export const alt = "SaveLink — Download video dari link YouTube, TikTok, Instagram, Facebook";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Gambar pratinjau saat link SaveLink dibagikan (WhatsApp, X, Facebook, ...). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "radial-gradient(1000px 520px at 50% -10%, rgba(249,115,22,0.35), transparent), #141110",
          color: "#FAFAF9",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "#F97316",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="44" height="44" viewBox="0 0 32 32">
              <path
                d="M16 7.5v11.25m0 0-4.6-4.6M16 18.75l4.6-4.6"
                fill="none"
                stroke="#1C1917"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M9.75 23.75h12.5" fill="none" stroke="#1C1917" strokeWidth="2.8" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>SaveLink</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2.5, display: "flex", flexWrap: "wrap" }}>
            <span>Download video dari&nbsp;</span>
            <span style={{ color: "#F97316" }}>link apa pun</span>
          </div>
          <div style={{ fontSize: 32, color: "#A8A29E" }}>YouTube · TikTok · Instagram · Facebook · X — HD sampai 4K, tanpa login</div>
        </div>
      </div>
    ),
    size,
  );
}
