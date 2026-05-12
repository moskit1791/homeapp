import { describe, expect, it } from 'vitest';
import { extractShoppingSourceFragments } from './shopping-ai.service';

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
