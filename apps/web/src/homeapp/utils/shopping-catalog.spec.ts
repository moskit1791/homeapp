import { it, expect, describe } from 'vitest';

import {
  getShoppingCategoryMeta,
  categorizeShoppingProduct,
  getShoppingProductSuggestions,
} from './shopping-catalog';

describe('webowy katalog zakupów', () => {
  it('klasyfikuje polskie nazwy bez uruchomieniowego importu shared-types', () => {
    expect(categorizeShoppingProduct('Mleko 2%')).toBe('Nabiał i jaja');
    expect(categorizeShoppingProduct('jajka')).toBe('Nabiał i jaja');
    expect(categorizeShoppingProduct('pomidory koktajlowe')).toBe('Owoce, warzywa i zioła');
    expect(getShoppingCategoryMeta('nieznana kategoria').title).toBe('Inne');
  });

  it('podpowiada produkty na podstawie fragmentu nazwy', () => {
    expect(getShoppingProductSuggestions('pap', 4).map((item) => item.name)).toContain(
      'papier toaletowy'
    );
  });
});
