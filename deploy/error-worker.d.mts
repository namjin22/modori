/** deploy/error-worker.mjs의 타입(시험이 불러 쓴다). Cloudflare에는 .mjs 파일만 붙여 넣는다. */
export function shouldReplace(status: number): boolean;
export function pickLocale(request: Request): "ko" | "en" | "ja";
export function renderErrorPage(input: { status: number; locale: string; ray?: string }): string;

declare const worker: { fetch(request: Request): Promise<Response> };
export default worker;
