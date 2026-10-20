/**
 * Render Dtask app icons from resources/icon-source.svg.
 *
 * Usage:
 *   npm run icons
 *
 * Outputs:
 *   resources/icon-source.png   1024x1024 master
 *   resources/icon.png           512x512 (electron-builder default icon)
 *   resources/icon.ico           multi-resolution Windows icon
 *   resources/icons/*.png        16..512 (macOS / Linux icon set)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RES = path.join(ROOT, "resources");
const ICONS = path.join(RES, "icons");
const SVG = path.join(RES, "icon-source.svg");
const SIZES = [16, 24, 32, 48, 64, 128, 256, 512];

/** Encode PNG buffers into a Windows .ico container. */
function buildIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const entries = Buffer.alloc(16 * count);
  let offset = header.length + entries.length;

  images.forEach(({ size, data }, i) => {
    const e = i * 16;
    entries.writeUInt8(size >= 256 ? 0 : size, e + 0);
    entries.writeUInt8(size >= 256 ? 0 : size, e + 1);
    entries.writeUInt8(0, e + 2); // palette
    entries.writeUInt8(0, e + 3); // reserved
    entries.writeUInt16LE(1, e + 4); // color planes
    entries.writeUInt16LE(32, e + 6); // bits per pixel
    entries.writeUInt32LE(data.length, e + 8);
    entries.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });

  return Buffer.concat([header, entries, ...images.map((i) => i.data)]);
}

async function main() {
  if (!fs.existsSync(SVG)) throw new Error(`missing source: ${SVG}`);
  fs.mkdirSync(ICONS, { recursive: true });

  const svg = fs.readFileSync(SVG);
  const render = (size) =>
    sharp(svg, { density: 384 })
      .resize(size, size, { fit: "fill" })
      .png({ compressionLevel: 9 })
      .toBuffer();

  // Master
  fs.writeFileSync(
    path.join(RES, "icon-source.png"),
    await render(1024),
  );
  console.log("wrote resources/icon-source.png (1024)");

  // Default app icon used by electron-builder
  fs.writeFileSync(path.join(RES, "icon.png"), await render(512));
  console.log("wrote resources/icon.png (512)");

  // Icon set
  const icoImages = [];
  for (const size of SIZES) {
    const data = await render(size);
    fs.writeFileSync(path.join(ICONS, `${size}x${size}.png`), data);
    icoImages.push({ size, data });
    console.log(`wrote resources/icons/${size}x${size}.png`);
  }

  // Windows icon
  fs.writeFileSync(path.join(RES, "icon.ico"), buildIco(icoImages));
  console.log("wrote resources/icon.ico");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
