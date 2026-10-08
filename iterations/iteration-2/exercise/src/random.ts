import mt19937 from "@stdlib/random-base-mt19937";

// 0以上1未満の数を返す擬似乱数．
export type Random = {
  next(): number;
};

// シードから，メルセンヌ・ツイスタによる擬似乱数を作る．同じシードからは同じ列ができる．
export function seededRandom(seed: number): Random {
  const generator = mt19937.factory({ seed });
  // generator()は0以上MAX以下の整数を返す．MAX + 1で割って0以上1未満にする．
  return { next: () => generator() / (generator.MAX + 1) };
}

// シード，キー，試行の番号から，試行ごとのシードを作る(FNV-1aハッシュ)．
// promptfooは試行を並行に実行するため，乱数の列を呼び出しの順序に依存させない．
export function trialSeed(seed: number, key: string, index: number): number {
  let hash = 0x811c9dc5;
  for (const char of `${seed}\u0000${key}\u0000${index}`) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash === 0 ? 1 : hash;
}
