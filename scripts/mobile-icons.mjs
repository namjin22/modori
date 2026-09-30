// Android 앱 아이콘과 시작 화면 그림을 앱 로고(app/icon.svg)로 다시 만든다. `node scripts/mobile-icons.mjs`
// sharp는 Next.js가 끌어오는 패키지라 package.json에 따로 적지 않았다. 로고를 바꿀 때만 다시 돌린다.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

const RES = path.join("mobile", "android", "app", "src", "main", "res");
const svg = readFileSync(path.join("app", "icon.svg"));
const BG = { r: 255, g: 255, b: 255, alpha: 1 };
const SPLASH_BG = { r: 247, g: 248, b: 251, alpha: 1 };

const glyph = (size) => sharp(svg, { density: 512 }).resize(size, size).png().toBuffer();

async function onCanvas(width, height, glyphSize, background, file, { round = false } = {}) {
  const canvas = sharp({ create: { width, height, channels: 4, background } });
  let image = await canvas.composite([{ input: await glyph(glyphSize), gravity: "center" }]).png().toBuffer();
  if (round) {
    const mask = Buffer.from(`<svg width="${width}" height="${height}"><circle cx="${width / 2}" cy="${height / 2}" r="${width / 2}"/></svg>`);
    image = await sharp(image).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  }
  await sharp(image).toFile(file);
}

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

for (const [name, scale] of Object.entries(DENSITIES)) {
  const dir = path.join(RES, `mipmap-${name}`);
  const legacy = Math.round(48 * scale);
  const adaptive = Math.round(108 * scale);
  await onCanvas(legacy, legacy, Math.round(legacy * 0.72), BG, path.join(dir, "ic_launcher.png"));
  await onCanvas(legacy, legacy, Math.round(legacy * 0.66), BG, path.join(dir, "ic_launcher_round.png"), { round: true });
  // 적응형 아이콘은 가운데 66%만 보장되므로 로고를 그 안에 둔다.
  await onCanvas(adaptive, adaptive, Math.round(adaptive * 0.5), { r: 0, g: 0, b: 0, alpha: 0 }, path.join(dir, "ic_launcher_foreground.png"));
}

for (const dir of readdirSync(RES).filter((name) => name.startsWith("drawable"))) {
  const file = path.join(RES, dir, "splash.png");
  if (!existsSync(file)) continue;
  const { width, height } = await sharp(file).metadata();
  await onCanvas(width, height, Math.round(Math.min(width, height) * 0.26), SPLASH_BG, file);
}
console.log("아이콘과 시작 화면을 다시 만들었어요.");
