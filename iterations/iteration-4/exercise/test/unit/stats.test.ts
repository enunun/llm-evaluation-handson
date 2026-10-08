import { describe, expect, it } from "vitest";
import { binomialInterval, judgeTarget, meanWithError } from "../../src/stats.ts";

describe("binomialInterval", () => {
  it("10回中10回の合格でも，区間の下限は1より小さい", () => {
    const interval = binomialInterval(10, 10, 0.95);
    expect(interval.lower).toBeCloseTo(0.6915, 4);
    expect(interval.upper).toBe(1);
  });

  it("10回中7回の合格では，Clopper-Pearson法の区間を返す", () => {
    const interval = binomialInterval(7, 10, 0.95);
    expect(interval.lower).toBeCloseTo(0.3475, 4);
    expect(interval.upper).toBeCloseTo(0.9333, 4);
  });

  it("10回中0回の合格でも，区間の上限は0より大きい", () => {
    const interval = binomialInterval(0, 10, 0.95);
    expect(interval.lower).toBe(0);
    expect(interval.upper).toBeCloseTo(0.3085, 4);
  });

  it("信頼水準を下げると，区間は狭くなる", () => {
    const wide = binomialInterval(7, 10, 0.95);
    const narrow = binomialInterval(7, 10, 0.8);
    expect(narrow.upper - narrow.lower).toBeLessThan(wide.upper - wide.lower);
  });

  it("試行を増やすと，区間は狭くなる", () => {
    const few = binomialInterval(7, 10, 0.95);
    const many = binomialInterval(70, 100, 0.95);
    expect(many.upper - many.lower).toBeLessThan(few.upper - few.lower);
  });

  it("試行が0回ならエラーにする", () => {
    expect(() => binomialInterval(0, 0, 0.95)).toThrow(RangeError);
  });
});

describe("meanWithError", () => {
  it("平均を求める", () => {
    expect(meanWithError([0.4, 0.6, 0.5, 0.5], 0.95).mean).toBeCloseTo(0.5);
  });

  it("標準誤差は，標本標準偏差を値の数の平方根で割ったものである", () => {
    expect(meanWithError([0, 1, 1, 1], 0.95).standardError).toBeCloseTo(0.5 / 2);
  });

  it("区間は，平均±z×標準誤差である", () => {
    const estimate = meanWithError([0.4, 0.6, 0.5, 0.5], 0.95);
    const halfWidth = 1.959964 * estimate.standardError;
    expect(estimate.interval.lower).toBeCloseTo(0.5 - halfWidth, 6);
    expect(estimate.interval.upper).toBeCloseTo(0.5 + halfWidth, 6);
  });

  it("区間を0から1の範囲に収める", () => {
    const estimate = meanWithError([0, 1, 1, 1], 0.95);
    expect(estimate.interval.upper).toBe(1);
    expect(estimate.interval.lower).toBeGreaterThan(0);
  });

  it("値が2つより少なければエラーにする", () => {
    expect(() => meanWithError([0.5], 0.95)).toThrow(RangeError);
  });
});

describe("judgeTarget", () => {
  it("区間の下限が目標以上ならmetである", () => {
    expect(judgeTarget({ lower: 0.9, upper: 0.99 }, 0.9)).toBe("met");
  });

  it("区間の上限が目標より小さければnot metである", () => {
    expect(judgeTarget({ lower: 0.7, upper: 0.89 }, 0.9)).toBe("not met");
  });

  it("区間が目標をまたげばinconclusiveである", () => {
    expect(judgeTarget({ lower: 0.85, upper: 0.95 }, 0.9)).toBe("inconclusive");
  });
});
