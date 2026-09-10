export const SHOPPING_CATEGORIES = [
  'Alkohole',
  'Apteczka',
  'Dania gotowe',
  'Dla zwierząt',
  'Dom i ogród',
  'Dziecko',
  'Elektronika',
  'Higiena',
  'Kawa i herbata',
  'Konserwy i przetwory',
  'Mięso i wędliny',
  'Mrożonki',
  'Nabiał i jaja',
  'Owoce, warzywa i zioła',
  'Papiernicze',
  'Pieczenie i dodatki',
  'Pieczywo',
  'Przyprawy, sosy i oleje',
  'Ryby i owoce morza',
  'Słodycze i przekąski',
  'Sypkie',
  'Środki czystości',
  'Ubrania',
  'Wege',
  'Woda i napoje',
  'Inne',
] as const;

type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

const CATEGORY_META: Record<ShoppingCategory, { color: string; emoji: string }> = {
  Alkohole: { color: '#8b5cf6', emoji: '🍷' },
  Apteczka: { color: '#ef4444', emoji: '💊' },
  'Dania gotowe': { color: '#f97316', emoji: '🥘' },
  'Dla zwierząt': { color: '#a16207', emoji: '🐾' },
  'Dom i ogród': { color: '#16a34a', emoji: '🏡' },
  Dziecko: { color: '#ec4899', emoji: '🍼' },
  Elektronika: { color: '#2563eb', emoji: '🔋' },
  Higiena: { color: '#06b6d4', emoji: '🧴' },
  'Kawa i herbata': { color: '#92400e', emoji: '☕' },
  'Konserwy i przetwory': { color: '#d97706', emoji: '🥫' },
  'Mięso i wędliny': { color: '#dc2626', emoji: '🥩' },
  Mrożonki: { color: '#0ea5e9', emoji: '🧊' },
  'Nabiał i jaja': { color: '#facc15', emoji: '🧀' },
  'Owoce, warzywa i zioła': { color: '#22c55e', emoji: '🥦' },
  Papiernicze: { color: '#6366f1', emoji: '📒' },
  'Pieczenie i dodatki': { color: '#fb7185', emoji: '🧁' },
  Pieczywo: { color: '#ca8a04', emoji: '🥖' },
  'Przyprawy, sosy i oleje': { color: '#eab308', emoji: '🫙' },
  'Ryby i owoce morza': { color: '#0284c7', emoji: '🐟' },
  'Słodycze i przekąski': { color: '#db2777', emoji: '🍫' },
  Sypkie: { color: '#b45309', emoji: '🌾' },
  'Środki czystości': { color: '#14b8a6', emoji: '🧽' },
  Ubrania: { color: '#7c3aed', emoji: '👕' },
  Wege: { color: '#15803d', emoji: '🌱' },
  'Woda i napoje': { color: '#0891b2', emoji: '🧃' },
  Inne: { color: '#64748b', emoji: '🛒' },
};

const RULES: Array<[ShoppingCategory, RegExp]> = [
  ['Alkohole', /\b(piwo|wino|alkohol|wodka|whisky|prosecco)\b/],
  ['Apteczka', /\b(witamin|lek|tablet|syrop|aptecz|plastr|termometr)\b/],
  ['Dania gotowe', /\b(pierog|pizza|zupa|gotow|hamburger)\b/],
  ['Dla zwierząt', /\b(karma|zwierzat|psa|kota|kuwet)\b/],
  ['Dom i ogród', /\b(folia|ogrod|grill|worki|znicz|donicz)\b/],
  ['Dziecko', /\b(pieluch|pampers|dzieck|niemowl)\b/],
  ['Elektronika', /\b(bateri|ladowark|kabel|zarowk|usb)\b/],
  ['Higiena', /\b(szampon|mydl|dezodor|pasta|szczotecz|podpask|tampon|zel|krem|kosmet)\b/],
  ['Kawa i herbata', /\b(kawa|herbat|matcha)\b/],
  ['Konserwy i przetwory', /\b(dzem|koncentrat|oliwk|puszk|konserw|kukurydz)\b/],
  ['Mięso i wędliny', /\b(kurczak|indyk|wolow|wieprz|mieso|wedlin|szynk|kielbas|parowk|boczek)\b/],
  ['Mrożonki', /\b(mrozon|lody|frytki)\b/],
  ['Nabiał i jaja', /\b(mleko|jaj|jogurt|kefir|ser|twarog|maslo|smietan|mozzarell|feta|skyr)\b/],
  [
    'Owoce, warzywa i zioła',
    /\b(?:pomidor|ogork|salat|papryk|marchew|ziemni|cebul|czosn|warzyw|brokul|awokad|banan|jabl|cytryn|owoc|truskawk|mango|kiwi)[a-z]*\b/,
  ],
  ['Papiernicze', /\b(zeszyt|dlugopis|olowek|papiernicz|notes)\b/],
  ['Pieczenie i dodatki', /\b(kakao|proszek do pieczenia|maka tortowa|budyn|galaretk)\b/],
  ['Pieczywo', /\b(chleb|bulk|bagiet|tost|pieczyw|croissant)\b/],
  ['Przyprawy, sosy i oleje', /\b(ketchup|olej|oliw|przypraw|majonez|musztard|sos|ocet|pesto)\b/],
  ['Ryby i owoce morza', /\b(ryb|losos|tunczyk|dorsz|sledz|krewet)\b/],
  ['Słodycze i przekąski', /\b(czekolad|ciast|baton|chips|cukierk|zelk|przekask|wafel)\b/],
  ['Sypkie', /\b(makaron|ryz|kasz|maka|cukier|sol|platk|musli|orzech)\b/],
  [
    'Środki czystości',
    /\b(plyn|proszek do prania|zmywark|prani|papier toaletowy|recznik|gabka|mop|sprzat)\b/,
  ],
  ['Ubrania', /\b(ubran|koszul|spodn|skarpet|buty|czapk)\b/],
  ['Wege', /\b(ciecierzyc|soczewic|tofu|wege|fasola)\b/],
  ['Woda i napoje', /\b(woda|sok|napoj|cola|pepsi|energetyk|smoothie)\b/],
];

const PRODUCT_SUGGESTIONS: Array<{ name: string; category: ShoppingCategory }> = [
  ['mleko', 'Nabiał i jaja'],
  ['jajka', 'Nabiał i jaja'],
  ['jogurt', 'Nabiał i jaja'],
  ['ser żółty', 'Nabiał i jaja'],
  ['chleb', 'Pieczywo'],
  ['bułki', 'Pieczywo'],
  ['makaron', 'Sypkie'],
  ['ryż', 'Sypkie'],
  ['pomidory', 'Owoce, warzywa i zioła'],
  ['ogórki', 'Owoce, warzywa i zioła'],
  ['ziemniaki', 'Owoce, warzywa i zioła'],
  ['banany', 'Owoce, warzywa i zioła'],
  ['kurczak', 'Mięso i wędliny'],
  ['szynka', 'Mięso i wędliny'],
  ['woda', 'Woda i napoje'],
  ['sok', 'Woda i napoje'],
  ['kawa', 'Kawa i herbata'],
  ['herbata', 'Kawa i herbata'],
  ['papier toaletowy', 'Środki czystości'],
  ['płyn do naczyń', 'Środki czystości'],
  ['szampon', 'Higiena'],
  ['pasta do zębów', 'Higiena'],
  ['karma dla psa', 'Dla zwierząt'],
  ['pieluchy', 'Dziecko'],
  ['czekolada', 'Słodycze i przekąski'],
  ['chipsy', 'Słodycze i przekąski'],
].map(([name, category]) => ({ name, category })) as Array<{
  name: string;
  category: ShoppingCategory;
}>;

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('pl-PL')
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

export function getShoppingCategoryMeta(value: string | null | undefined) {
  const normalized = normalize(value ?? '');
  const category = SHOPPING_CATEGORIES.find((item) => normalize(item) === normalized) ?? 'Inne';
  return { ...CATEGORY_META[category], title: category };
}

export function categorizeShoppingProduct(value: string): ShoppingCategory {
  const normalized = normalize(value);
  const catalogMatch = PRODUCT_SUGGESTIONS.find(({ name }) => normalize(name) === normalized);

  if (catalogMatch) return catalogMatch.category;

  return RULES.find(([, pattern]) => pattern.test(normalized))?.[0] ?? 'Inne';
}

export function getShoppingProductSuggestions(query: string, limit = 8) {
  const normalized = normalize(query);
  if (!normalized) return [];
  return PRODUCT_SUGGESTIONS.filter(({ name }) => normalize(name).includes(normalized)).slice(
    0,
    limit
  );
}
