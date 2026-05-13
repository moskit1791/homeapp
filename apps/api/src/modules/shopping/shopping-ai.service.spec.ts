import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractShoppingSourceFragments, ShoppingAiService } from './shopping-ai.service';

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.stubEnv('GEMINI_MODEL', 'gemini-test');
  vi.stubEnv('GEMINI_TIMEOUT_MS', '15000');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('extractShoppingSourceFragments', () => {
  it('turns a messy shopping note into coverable source fragments', () => {
    const fragments = extractShoppingSourceFragments(
      [
        'Papryka, boczniaki, (Kurczak) chleb tostowy, coś do mikołaja',
        'Lista zakupów:',
        'grill (kiełbasa, Pieczywo czosnkowe, wyposażenie grilla), pesto barilla x2'
      ].join('\n')
    );
    const texts = fragments.map((fragment) => fragment.text);

    expect(texts).toContain('Papryka');
    expect(texts).toContain('boczniaki');
    expect(texts).toContain('Kurczak');
    expect(texts).toContain('chleb tostowy');
    expect(texts).toContain('coś do mikołaja');
    expect(texts).toContain('grill');
    expect(texts).toContain('kiełbasa');
    expect(texts).toContain('Pieczywo czosnkowe');
    expect(texts).toContain('wyposażenie grilla');
    expect(texts).toContain('pesto barilla x2');
    expect(texts).not.toContain('Lista zakupów');
  });
});

describe('ShoppingAiService', () => {
  it('keeps vague shopping wishes in Inne when Gemini returns them as items', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    clarificationMessage: '',
                    ignoredSourceFragments: [],
                    items: [
                      {
                        category: 'Dziecko i prezenty',
                        name: 'coś do mikołaja',
                        note: '',
                        quantity: '',
                        sourceFragmentIds: ['f1']
                      }
                    ],
                    status: 'ready',
                    unresolvedSourceFragments: []
                  })
                }
              ]
            }
          }
        ]
      }),
      ok: true
    });
    vi.stubGlobal('fetch', fetchMock);

    const plan = await new ShoppingAiService().planImport('coś do mikołaja');

    expect(plan.items[0]).toEqual(
      expect.objectContaining({
        category: 'Inne',
        name: 'coś do mikołaja'
      })
    );
  });

  it('saves vague shopping wishes as Inne instead of asking for clarification', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    clarificationMessage: 'Co dokładnie kupić?',
                    ignoredSourceFragments: [],
                    items: [],
                    status: 'needs_clarification',
                    unresolvedSourceFragments: [
                      {
                        id: 'f1',
                        question: 'Co kupić?',
                        reason: 'Zbyt ogólne'
                      }
                    ]
                  })
                }
              ]
            }
          }
        ]
      }),
      ok: true
    });
    vi.stubGlobal('fetch', fetchMock);

    const plan = await new ShoppingAiService().planImport('coś do mikołaja');

    expect(plan.items).toEqual([
      expect.objectContaining({
        category: 'Inne',
        name: 'coś do mikołaja',
        quantity: '',
        sourceFragmentIds: ['f1']
      })
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(':generateContent?key=test-key'),
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json'
        }
      })
    );
  });
});
