import { describe, expect, it } from "vitest";
import { seededRandom, trialSeed } from "../../src/random.ts";

const take = (seed: number, count: number) => {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => random.next());
};

describe("seededRandom", () => {
  it("同じシードからは同じ乱数の列を作る", () => {
    expect(take(1, 5)).toEqual(take(1, 5));
  });

  it("違うシードからは違う乱数の列を作る", () => {
    expect(take(1, 5)).not.toEqual(take(2, 5));
  });

  it("0以上1未満の数を返す", () => {
    for (const value of take(42, 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("trialSeed", () => {
  it("同じシード，キー，番号からは同じシードを作る", () => {
    expect(trialSeed(1, "本が届かない", 3)).toBe(trialSeed(1, "本が届かない", 3));
  });

  it("試行の番号が違えば違うシードを作る", () => {
    expect(trialSeed(1, "本が届かない", 0)).not.toBe(trialSeed(1, "本が届かない", 1));
  });

  it("キーが違えば違うシードを作る", () => {
    expect(trialSeed(1, "本が届かない", 0)).not.toBe(trialSeed(1, "返金して", 0));
  });

  it("seededRandomに渡せる，1以上2^32未満の整数を返す", () => {
    for (let index = 0; index < 100; index++) {
      const seed = trialSeed(7, "key", index);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(1);
      expect(seed).toBeLessThan(2 ** 32);
    }
  });
});
