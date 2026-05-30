// Generates a 1024x1024 placeholder app icon (build/icon.png) using only Node
// builtins, so packaging never fails on a missing icon. Replace with a real
// branded icon before shipping. PNG is hand-encoded (IHDR/IDAT/IEND) to avoid
// any image-library dependency.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 1024;
const BG = [12, 166, 120]; // teal
const FG = [255, 249, 219]; // cream
const INSET = Math.floor(SIZE * 0.3);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "build", "icon.png");

const CHANNELS = 3; // truecolor RGB
const stride = SIZE * CHANNELS;
const raw = Buffer.alloc((stride + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (stride + 1);
  raw[rowStart] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    const inSquare =
      x >= INSET && x < SIZE - INSET && y >= INSET && y < SIZE - INSET;
    const [r, g, b] = inSquare ? FG : BG;
    const p = rowStart + 1 + x * CHANNELS;
    raw[p] = r;
    raw[p + 1] = g;
    raw[p + 2] = b;
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type: truecolor
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

const png = Buffer.concat([
  signature,
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, png);
console.log(`Wrote placeholder icon: ${outPath} (${png.length} bytes)`);
