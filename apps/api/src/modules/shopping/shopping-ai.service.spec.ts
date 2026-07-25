import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractShoppingSourceFragments,
  ShoppingAiService,
} from "./shopping-ai.service";

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GEMINI_MODEL", "gemini-test");
  vi.stubEnv("GEMINI_TIMEOUT_MS", "15000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("extractShoppingSourceFragments", () => {
  it("turns a messy shopping note into coverable source fragments", () => {
    const fragments = extractShoppingSourceFragments(
      [
        "Papryka, boczniaki, (Kurczak) chleb tostowy, coś do mikołaja",
        "Lista zakupów:",
        "prosciutto? Salami",
        "grill (kiełbasa, Pieczywo czosnkowe, wyposażenie grilla), pesto barilla x2",
      ].join("\n"),
    );
    const texts = fragments.map((fragment) => fragment.text);

    expect(texts).toContain("Papryka");
    expect(texts).toContain("boczniaki");
    expect(texts).toContain("Kurczak");
    expect(texts).toContain("chleb tostowy");
    expect(texts).toContain("coś do mikołaja");
    expect(texts).toContain("prosciutto?");
    expect(texts).toContain("Salami");
    expect(texts).toContain("grill");
    expect(texts).toContain("kiełbasa");
    expect(texts).toContain("Pieczywo czosnkowe");
    expect(texts).toContain("wyposażenie grilla");
    expect(texts).toContain("pesto barilla x2");
    expect(texts).not.toContain("Lista zakupów");
  });
});

describe("ShoppingAiService", () => {
  it("keeps vague shopping wishes in Inne when Gemini returns them as items", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    clarificationMessage: "",
                    ignoredSourceFragments: [],
                    items: [
                      {
                        category: "Dziecko",
                        name: "coś do mikołaja",
                        note: "",
                        quantity: "",
                        sourceFragmentIds: ["f1"],
                      },
                    ],
                    status: "ready",
                    unresolvedSourceFragments: [],
                  }),
                },
              ],
            },
          },
        ],
      }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const plan = await new ShoppingAiService().planImport("coś do mikołaja");

    expect(plan.items[0]).toEqual(
      expect.objectContaining({
        category: "Inne",
        name: "coś do mikołaja",
      }),
    );
  });

  it("saves vague shopping wishes as Inne instead of asking for clarification", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    clarificationMessage: "Co dokładnie kupić?",
                    ignoredSourceFragments: [],
                    items: [],
                    status: "needs_clarification",
                    unresolvedSourceFragments: [
                      {
                        id: "f1",
                        question: "Co kupić?",
                        reason: "Zbyt ogólne",
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const plan = await new ShoppingAiService().planImport("coś do mikołaja");

    expect(plan.items).toEqual([
      expect.objectContaining({
        category: "Inne",
        name: "Coś do mikołaja",
        quantity: "",
        sourceFragmentIds: ["f1"],
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(":generateContent?key=test-key"),
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
  });

  it("adds missed natural-list fragments as Inne instead of failing the import", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    clarificationMessage: "",
                    ignoredSourceFragments: [],
                    items: [
                      {
                        category: "Nabiał i jaja",
                        name: "Mleko",
                        note: "",
                        quantity: "2l",
                        sourceFragmentIds: ["f1"],
                      },
                    ],
                    status: "ready",
                    unresolvedSourceFragments: [],
                  }),
                },
              ],
            },
          },
        ],
      }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const plan = await new ShoppingAiService().planImport(
      "mleko 2l, coś do obiadu",
    );

    expect(plan.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "Nabiał i jaja",
          name: "Mleko",
          quantity: "2l",
        }),
        expect.objectContaining({
          category: "Inne",
          name: "Coś do obiadu",
          quantity: "",
        }),
      ]),
    );
  });

  it("ignores missed list headings instead of saving them as products", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    clarificationMessage: "",
                    ignoredSourceFragments: [],
                    items: [
                      {
                        category: "Pieczywo",
                        name: "Chleb",
                        note: "",
                        quantity: "",
                        sourceFragmentIds: ["f2"],
                      },
                    ],
                    status: "ready",
                    unresolvedSourceFragments: [],
                  }),
                },
              ],
            },
          },
        ],
      }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const plan = await new ShoppingAiService().planImport("zakupy\nchleb");

    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toEqual(
      expect.objectContaining({
        category: "Pieczywo",
        name: "Chleb",
      }),
    );
    expect(plan.ignoredSourceFragments).toEqual([
      {
        id: "f1",
        reason: "Kontekst listy zakupów.",
      },
    ]);
  });

  it("repairs obvious product categories when Gemini returns Inne", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    clarificationMessage: "",
                    ignoredSourceFragments: [],
                    items: [
                      {
                        category: "Inne",
                        name: "Jabłka",
                        note: "",
                        quantity: "",
                        sourceFragmentIds: ["f1"],
                      },
                      {
                        category: "Inne",
                        name: "Granat",
                        note: "",
                        quantity: "",
                        sourceFragmentIds: ["f2"],
                      },
                      {
                        category: "Inne",
                        name: "Pieczarki",
                        note: "",
                        quantity: "",
                        sourceFragmentIds: ["f3"],
                      },
                      {
                        category: "Inne",
                        name: "Burrata",
                        note: "",
                        quantity: "",
                        sourceFragmentIds: ["f4"],
                      },
                    ],
                    status: "ready",
                    unresolvedSourceFragments: [],
                  }),
                },
              ],
            },
          },
        ],
      }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const plan = await new ShoppingAiService().planImport(
      "Jabłka, granat, pieczarki, burrata",
    );

    expect(plan.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "Owoce, warzywa i zioła",
          name: "Jabłka",
        }),
        expect.objectContaining({
          category: "Owoce, warzywa i zioła",
          name: "Granat",
        }),
        expect.objectContaining({
          category: "Owoce, warzywa i zioła",
          name: "Pieczarki",
        }),
        expect.objectContaining({ category: "Nabiał i jaja", name: "Burrata" }),
      ]),
    );
  });

  it("repairs inflected fruit, vegetable, herb and mushroom names returned as Inne", async () => {
    const names = [
      "Świeże maliny",
      "Gruszki konferencja",
      "Rzodkiewki",
      "Dynia hokkaido",
      "Jarmuż",
      "Mięta",
      "Kurki",
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    clarificationMessage: "",
                    ignoredSourceFragments: [],
                    items: names.map((name, index) => ({
                      category: "Inne",
                      name,
                      note: "",
                      quantity: "",
                      sourceFragmentIds: [`f${index + 1}`],
                    })),
                    status: "ready",
                    unresolvedSourceFragments: [],
                  }),
                },
              ],
            },
          },
        ],
      }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const plan = await new ShoppingAiService().planImport(names.join(", "));

    expect(plan.items).toHaveLength(names.length);
    expect(plan.items).toEqual(
      expect.arrayContaining(
        names.map((name) =>
          expect.objectContaining({
            category: "Owoce, warzywa i zioła",
            name,
          }),
        ),
      ),
    );
  });

  it("falls back to a deterministic parser when Gemini quota is exhausted", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () =>
        JSON.stringify({
          error: {
            code: 429,
            message: "Quota exceeded",
            status: "RESOURCE_EXHAUSTED",
          },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const plan = await new ShoppingAiService().planImport(
      "Jabłka, granat, pomidor X2, pomidorki, Pieczarki, papryka czerwona, prosciutto? Salami, feta, grill (kiełbasa, Pieczywo czosnkowe, wyposażenie grilla), tortille, pesto barilla x2",
    );

    expect(plan.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "Owoce, warzywa i zioła",
          name: "Jabłka",
        }),
        expect.objectContaining({
          category: "Owoce, warzywa i zioła",
          name: "Pomidor",
          quantity: "x2",
        }),
        expect.objectContaining({
          category: "Mięso i wędliny",
          name: "Prosciutto",
          quantity: "?",
        }),
        expect.objectContaining({
          category: "Mięso i wędliny",
          name: "Salami",
        }),
        expect.objectContaining({
          category: "Nabiał i jaja",
          name: "Feta",
        }),
        expect.objectContaining({
          category: "Przyprawy, sosy i oleje",
          name: "Pesto barilla",
          quantity: "x2",
        }),
      ]),
    );
    expect(plan.ignoredSourceFragments).toEqual(
      expect.arrayContaining([
        {
          id: expect.any(String),
          reason: "Kontekst listy zakupów.",
        },
      ]),
    );
  });
});
