// Membuat semua ikon dari satu SVG logo: favicon (ICO + SVG), apple-icon, ikon PWA (any + maskable).
// Jalankan: node scripts/generate-icons.mjs
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORANGE = "#F97316";
const INK = "#1C1917";

const glyph = (stroke = 2.6) => `
  <path d="M16 7.5v11.25m0 0-4.6-4.6M16 18.75l4.6-4.6" fill="none" stroke="${INK}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9.75 23.75h12.5" fill="none" stroke="${INK}" stroke-width="${stroke}" stroke-linecap="round"/>`;

/** Ikon biasa: kotak membulat (transparan di sudut). */
const roundedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="9" fill="${ORANGE}"/>
  <rect x="1" y="1" width="30" height="15" rx="8" fill="#FFFFFF" opacity="0.12"/>${glyph()}
</svg>`;

/** Full-bleed (apple-icon & maskable): latar penuh, glyph diperkecil ke zona aman 60%. */
const fullBleedSvg = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="${ORANGE}"/>
  <g transform="translate(16 16) scale(${scale}) translate(-16 -15.6)">${glyph(2.6)}</g>
</svg>`;

const png = (svg, size) => sharp(Buffer.from(svg), { density: 512 }).resize(size, size).png().toBuffer();

/** ICO berisi beberapa PNG (didukung semua browser modern). */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

async function main() {
  const iconsDir = path.join(root, "public", "icons");
  await mkdir(iconsDir, { recursive: true });

  await writeFile(path.join(iconsDir, "icon-192.png"), await png(roundedSvg, 192));
  await writeFile(path.join(iconsDir, "icon-512.png"), await png(roundedSvg, 512));
  await writeFile(path.join(iconsDir, "maskable-512.png"), await png(fullBleedSvg(0.62), 512));
  await writeFile(path.join(root, "src", "app", "apple-icon.png"), await png(fullBleedSvg(0.78), 180));
  await writeFile(path.join(root, "src", "app", "icon.svg"), roundedSvg.trim() + "\n");

  const ico = buildIco([
    { size: 16, data: await png(roundedSvg, 16) },
    { size: 32, data: await png(roundedSvg, 32) },
    { size: 48, data: await png(roundedSvg, 48) },
  ]);
  await writeFile(path.join(root, "src", "app", "favicon.ico"), ico);
  console.log("✓ ikon dibuat: public/icons/*, src/app/{favicon.ico,icon.svg,apple-icon.png}");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
