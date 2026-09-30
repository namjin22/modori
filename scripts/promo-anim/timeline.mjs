// 애니메이션 홍보 영상의 장면 시각과 효과음 시각. 화면(scene.html)과 음악(music.mjs)이 같이 쓴다.
export const FPS = 30;
export const DURATION = 30;

// 장면 시작 시각. 마지막 장면은 DURATION까지.
export const SCENES = { desk: 0, write: 4.2, fill: 9.2, friends: 14.2, montage: 19.2, sunset: 25.2 };

const at = (scene, s) => SCENES[scene] + s;

// kind: swoosh(장면 넘김) pop(색이 터짐) bloop(차오름, pitch로 음 높이) tick(글자) click(체크) bump(부딪힘) chime(마지막)
export const SFX = [
  ...["write", "fill", "friends", "montage", "sunset"].map((scene) => ({ kind: "swoosh", t: SCENES[scene] - 0.2 })),
  ...[0.5, 0.65, 0.8, 0.95, 1.1, 1.25, 1.4, 1.55, 1.7].map((s) => ({ kind: "tick", t: at("write", s) })),
  { kind: "click", t: at("write", 2.1) },
  { kind: "pop", t: at("write", 2.4), pitch: 1 },
  { kind: "pop", t: at("write", 2.65), pitch: 1.25 },
  { kind: "pop", t: at("write", 2.9), pitch: 1.5 },
  { kind: "pop", t: at("write", 3.15), pitch: 1.9 },
  ...[0, 1, 2, 3].map((i) => ({ kind: "bloop", t: at("fill", 0.4 + i * 0.45), pitch: [1, 1.25, 1.5, 2][i] })),
  { kind: "chime", t: at("fill", 2.6) },
  { kind: "bump", t: at("friends", 1.35) },
  ...[0, 1, 2].map((k) => ({ kind: "click", t: at("montage", k * 2 + 0.9) })),
  ...[0, 1, 2].map((k) => ({ kind: "pop", t: at("montage", k * 2 + 0.95), pitch: [1, 1.25, 1.5][k] })),
  { kind: "chime", t: at("sunset", 1.6) },
];

// 음악이 굵어지는 시각(킥이 들어오는 곳, 박수가 들어오는 곳).
export const MUSIC = { bpm: 110, kickFrom: SCENES.write, clapFrom: SCENES.fill };
