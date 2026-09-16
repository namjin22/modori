// 앱 아이콘을 코드로 굽는다. 디자인 파일을 주고받지 않아도 색을 바꾸면 다시 나온다.
// 그리는 것: 브랜드색 둥근 사각형 위에 흰 체크 하나.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { Buffer } from "node:buffer";

const BRAND = [0x00, 0xb2, 0x6a];

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// 둥근 사각형 안쪽이면 0, 밖이면 양수. 경계에서 부드럽게 섞으려고 거리로 돌려준다.
function roundedRectDistance(x, y, size, radius) {
  const qx = Math.abs(x - size / 2) - (size / 2 - radius);
  const qy = Math.abs(y - size / 2) - (size / 2 - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function renderIcon(size, { squircle = true } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  // 애플 홈 화면 아이콘은 iOS가 알아서 깎으므로 꽉 채운다.
  const radius = squircle ? size * 0.22 : 0;
  const stroke = size * 0.085;

  // 체크 좌표(0~1)를 아이콘 크기로 늘린다.
  const a = [0.3 * size, 0.52 * size];
  const b = [0.44 * size, 0.66 * size];
  const c = [0.71 * size, 0.36 * size];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const outside = roundedRectDistance(px, py, size, radius);
      // 계단 현상을 없애려고 경계 1픽셀을 섞는다.
      const inside = Math.max(0, Math.min(1, 0.5 - outside));

      const toCheck = Math.min(
        distanceToSegment(px, py, a[0], a[1], b[0], b[1]),
        distanceToSegment(px, py, b[0], b[1], c[0], c[1]),
      );
      const check = Math.max(0, Math.min(1, stroke / 2 - toCheck + 0.5));

      const i = (y * size + x) * 4;
      pixels[i] = Math.round(BRAND[0] + (255 - BRAND[0]) * check);
      pixels[i + 1] = Math.round(BRAND[1] + (255 - BRAND[1]) * check);
      pixels[i + 2] = Math.round(BRAND[2] + (255 - BRAND[2]) * check);
      pixels[i + 3] = Math.round(255 * inside);
    }
  }
  return pixels;
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function toPng(pixels, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 채널당 8비트
  ihdr[9] = 6; // RGBA
  const stride = size * 4;
  // 각 줄 앞에 필터 바이트 0을 붙이는 것이 PNG 형식이다.
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });

const targets = [
  ["public/icons/icon-192.png", 192, { squircle: true }],
  ["public/icons/icon-512.png", 512, { squircle: true }],
  ["public/icons/apple-touch-icon.png", 180, { squircle: false }],
];

for (const [path, size, options] of targets) {
  writeFileSync(path, toPng(renderIcon(size, options), size));
  console.log(`${path} (${size}x${size})`);
}
