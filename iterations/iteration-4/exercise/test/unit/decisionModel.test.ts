import { describe, expect, it } from "vitest";
import { fakeDecisionModel, ollamaDecisionModel, type Fetch } from "../../src/decisionModel.ts";
import { seededRandom } from "../../src/random.ts";

describe("ollamaDecisionModel", () => {
  it("/v1/systemoneに状態とnoul型の質問を送り，答えの確率を返す", async () => {
    const requests: { url: string; body: unknown }[] = [];
    const fetch: Fetch = async (url, init) => {
      requests.push({
        url,
        body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
      });
      return Response.json({ answers: { decision: { type: "noul", noul: 0.88 } } });
    };
    const model = ollamaDecisionModel({ host: "http://ollama:11434", model: "tev1", fetch });
    expect(await model.noul("問い合わせ：…", "返信は答えているか")).toBe(0.88);
    expect(requests).toEqual([
      {
        url: "http://ollama:11434/v1/systemone",
        body: {
          model: "tev1",
          state: "問い合わせ：…",
          questions: { decision: { type: "noul", instructions: "返信は答えているか" } },
        },
      },
    ]);
  });

  it("応答が失敗なら，状態コードを含むエラーにする", async () => {
    const fetch: Fetch = async () => new Response("model not found", { status: 404 });
    const model = ollamaDecisionModel({ host: "http://ollama:11434", model: "tev1", fetch });
    await expect(model.noul("s", "q")).rejects.toThrow("404");
  });
});

describe("fakeDecisionModel", () => {
  const state = (reply: string) => `問い合わせ：本が届きません\n返信：${reply}`;

  it("noiseが0なら，問い合わせに答える返信に高い確率を返す", async () => {
    const model = fakeDecisionModel({ random: seededRandom(1), noise: 0 });
    expect(
      await model.noul(state("3営業日以内に発送いたします．"), "答えているか"),
    ).toBeGreaterThan(0.8);
  });

  it("noiseが0なら，宣伝だけの返信に低い確率を返す", async () => {
    const model = fakeDecisionModel({ random: seededRandom(1), noise: 0 });
    expect(await model.noul(state("ただいまセールを実施中です．"), "答えているか")).toBeLessThan(
      0.2,
    );
  });

  it("noiseがあれば確率が揺れるが，0以上1以下に収まる", async () => {
    const model = fakeDecisionModel({ random: seededRandom(1), noise: 0.5 });
    const values = await Promise.all(
      Array.from({ length: 50 }, () => model.noul(state("ご連絡いたします．"), "答えているか")),
    );
    expect(new Set(values).size).toBeGreaterThan(1);
    expect(values.every((v) => v >= 0 && v <= 1)).toBe(true);
  });
});
