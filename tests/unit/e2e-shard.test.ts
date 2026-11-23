// scripts/e2e-shard.mjs: E2E 시험 파일을 시간 기준으로 고르게 나누는 도구(2026-11-23).
// CI 조각이 서로 다른 계산을 하면 어떤 파일은 두 번 돌고 어떤 파일은 한 번도 안 돌 수 있다. 그것을 막는다.
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { listSpecs, partition } from "../../scripts/e2e-shard.mjs";

const weights: Record<string, number> = JSON.parse(readFileSync("scripts/e2e-weights.json", "utf8"));
const files = listSpecs();

describe("partition", () => {
  it.each([1, 4, 8, 13])("%i조각: 실제 시험 파일이 모두, 정확히 한 번씩만 들어간다", (total) => {
    const placed = partition(files, weights, total).flatMap((bin) => bin.files);
    expect(placed).toHaveLength(files.length);
    expect(new Set(placed)).toEqual(new Set(files));
  });

  it("실제 시험 파일을 찾는다(빈 목록이면 모든 조각이 아무것도 안 돌고 통과한다)", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files.every((f) => f.startsWith("tests/e2e/") && f.endsWith(".spec.ts"))).toBe(true);
  });

  it("같은 입력이면 늘 같은 배치다(조각마다 따로 계산해도 겹치지 않으려면 필요하다)", () => {
    expect(partition(files, weights, 8)).toEqual(partition([...files].reverse(), weights, 8));
  });

  it("조각 합계의 차이는 가장 무거운 파일 하나를 넘지 않는다", () => {
    const heaviest = Math.max(...files.map((f) => weights[f] ?? 0));
    const sums = partition(files, weights, 8).map((bin) => bin.sum);
    expect(Math.max(...sums) - Math.min(...sums)).toBeLessThanOrEqual(heaviest);
  });

  it("가중치에 없는 새 파일도 빠지지 않고 한 조각에 들어간다", () => {
    const added = [...files, "tests/e2e/zz-new-feature.spec.ts"];
    const bins = partition(added, weights, 8);
    const holders = bins.filter((bin) => bin.files.includes("tests/e2e/zz-new-feature.spec.ts"));
    expect(holders).toHaveLength(1);
    expect(bins.flatMap((bin) => bin.files)).toHaveLength(added.length);
  });

  it("가중치가 하나도 없어도 모든 파일을 나눈다", () => {
    const bins = partition(files, {}, 4);
    expect(bins.flatMap((bin) => bin.files)).toHaveLength(files.length);
    const sizes = bins.map((bin) => bin.files.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it("무거운 파일은 서로 다른 조각으로 흩어진다", () => {
    const [a, b, c] = [...files].sort((x, y) => (weights[y] ?? 0) - (weights[x] ?? 0));
    const bins = partition(files, weights, 8);
    const where = (f: string) => bins.findIndex((bin) => bin.files.includes(f));
    expect(new Set([where(a), where(b), where(c)]).size).toBe(3);
  });
});
