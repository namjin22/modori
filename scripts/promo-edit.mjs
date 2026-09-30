// 녹화(docs/promo/modori-promo.webm)에 자막과 배경 음악을 얹어 mp4로 만든다. `npm run promo:edit`.
// FFmpeg가 있어야 한다(윈도: winget install Gyan.FFmpeg). 음악은 저작권 걱정 없게 직접 만든 잔잔한 화음이다.
// 다른 음악을 쓰려면 MUSIC=파일경로 로 준다.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const DIR = path.join("docs", "promo");
const { marks, captions } = JSON.parse(readFileSync(path.join(DIR, "timeline.json"), "utf8"));
const order = ["home", "write", "check", "carry", "friend", "end"];
const start = marks.home;
const total = marks.finish - start;

// 홈이 보이는 순간부터 자른다(그 앞은 로그인 화면).
const t = (name) => (marks[name] - start).toFixed(2);
const inputs = ["-ss", start.toFixed(2), "-i", path.join(DIR, "modori-promo.webm")];
const filters = ["[0:v]scale=1080:1920:flags=lanczos,setsar=1[v0]"];
order.forEach((key, i) => {
  inputs.push("-loop", "1", "-i", path.join(DIR, `caption-${key}.png`));
  const from = t(key);
  const to = i + 1 < order.length ? t(order[i + 1]) : total.toFixed(2);
  filters.push(`[${i + 1}:v]scale=1080:1920,format=rgba,fade=t=in:st=${from}:d=0.3:alpha=1,fade=t=out:st=${(to - 0.3).toFixed(2)}:d=0.3:alpha=1[c${i}]`);
});
let last = "v0";
order.forEach((key, i) => {
  const from = t(key);
  const to = i + 1 < order.length ? t(order[i + 1]) : total.toFixed(2);
  filters.push(`[${last}][c${i}]overlay=enable='between(t,${from},${to})'[o${i}]`);
  last = `o${i}`;
});

const music = process.env.MUSIC;
const audioIndex = order.length + 1;
if (music) inputs.push("-i", music);
else inputs.push("-f", "lavfi", "-t", total.toFixed(2), "-i", "aevalsrc=0.10*sin(2*PI*261.63*t)+0.08*sin(2*PI*329.63*t)+0.08*sin(2*PI*392*t)+0.05*sin(2*PI*523.25*t):s=44100");
filters.push(`[${audioIndex}:a]lowpass=f=1800,tremolo=f=0.35:d=0.25,afade=t=in:d=1.5,afade=t=out:st=${(total - 2).toFixed(2)}:d=2,volume=0.6[a]`);

const out = path.join(DIR, "modori-promo.mp4");
execFileSync(
  "ffmpeg",
  ["-y", ...inputs, "-filter_complex", filters.join(";"), "-map", `[${last}]`, "-map", "[a]", "-t", total.toFixed(2),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-shortest", out],
  { stdio: "inherit" },
);
console.log(`만들었어요: ${out}`);
