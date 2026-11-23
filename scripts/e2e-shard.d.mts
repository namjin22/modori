/** scripts/e2e-shard.mjs의 타입(시험이 불러 쓴다). */
export function listSpecs(dir?: string): string[];
export function partition(
  files: string[],
  weights: Record<string, number>,
  total: number,
): { sum: number; files: string[] }[];
