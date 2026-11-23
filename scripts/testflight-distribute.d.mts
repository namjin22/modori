/** scripts/testflight-distribute.mjs의 타입(시험이 불러 쓴다). */
export function makeToken(input: { keyId: string; issuerId: string; privateKey: string; now?: number }): string;

type BetaGroup = { id: string; attributes?: { name?: string; isInternalGroup?: boolean } };
export function pickExternalGroup<T extends BetaGroup>(groups: T[]): T;

export function stepFor(externalBuildState: string): "submit" | "add-only" | "wait" | "blocked";
