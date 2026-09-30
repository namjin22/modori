// 코드로 그린 30초 애니메이션 홍보 영상을 만든다. `npm run promo:anim` → docs/promo/modori-promo-anim.mp4
// 화면(scripts/promo-anim/scene.html)을 프레임마다 그려 캡처하고, 직접 만든 음악과 합친다. FFmpeg가 필요하다.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

import { makeMusic } from "./promo-anim/music.mjs";
import * as timeline from "./promo-anim/timeline.mjs";

const OUT_DIR = path.join("docs", "promo");
const WAV = path.join(OUT_DIR, "modori-promo-anim.wav");
const OUT = path.join(OUT_DIR, "modori-promo-anim.mp4");
const { FPS, DURATION } = timeline;

mkdirSync(OUT_DIR, { recursive: true });
// PREVIEW=1.5,7,12 처럼 시각(초)을 주면 그 장면만 PNG로 뽑아 확인한다(영상은 만들지 않는다).
const preview = process.env.PREVIEW?.split(",").map(Number);
if (!preview) makeMusic(WAV);

const ffmpeg = preview ? null : spawn(
  "ffmpeg",
  ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-i", WAV,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-r", String(FPS), "-c:a", "aac", "-b:a", "192k", "-shortest", OUT],
  { stdio: ["pipe", "inherit", "inherit"] },
);
const finished = preview ? Promise.resolve() : new Promise((resolve, reject) => {
  ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg 종료 코드 ${code}`))));
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.addInitScript(`window.TL = ${JSON.stringify({ SCENES: timeline.SCENES })};`);
await page.goto(pathToFileURL(path.resolve("scripts/promo-anim/scene.html")).href);
await page.evaluate(() => document.fonts.ready);

if (preview) {
  for (const t of preview) {
    await page.evaluate((time) => window.render(time), t);
    await page.screenshot({ path: path.join(OUT_DIR, `preview-${t}.png`) });
  }
  await browser.close();
  process.exit(0);
}

const frames = FPS * DURATION;
for (let i = 0; i < frames; i += 1) {
  await page.evaluate((t) => window.render(t), i / FPS);
  const shot = await page.screenshot({ type: "jpeg", quality: 92 });
  if (!ffmpeg.stdin.write(shot)) await new Promise((resolve) => ffmpeg.stdin.once("drain", resolve));
  if (i % 90 === 0) console.log(`${i}/${frames} 프레임`);
}
ffmpeg.stdin.end();
await browser.close();
await finished;
console.log(`만들었어요: ${OUT}`);
