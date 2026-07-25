export const MODULE_KEYS = [
  "start",
  "finances",
  "meal_planner",
  "calendar",
  "todo",
  "notes",
  "shopping",
  "cleaning",
  "annual_costs",
  "data_entries",
  "attachments",
  "household_members",
  "permissions",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const ENCRYPTABLE_MODULE_KEYS = [
  "finances",
  "calendar",
  "meal_planner",
  "shopping",
  "todo",
  "notes",
  "cleaning",
  "annual_costs",
  "data_entries",
  "attachments",
] as const;

export type EncryptableModuleKey = (typeof ENCRYPTABLE_MODULE_KEYS)[number];

export type PermissionAction = "read" | "create" | "update" | "delete";

export type AccountStatus = "inactive" | "active" | "banned";

export type HouseholdMemberRole = "owner" | "member";

export type ScopeType = "household" | "member";

export type ShoppingListType = "daily" | "tomorrow" | "long_term" | "pantry";

export type TodoStatus = "todo" | "done";

export type CleaningFrequencyMode = "preset" | "custom_days";

export const REALTIME_EVENTS = [
  "finance.changed",
  "finance.month.generated",
  "finance.month.deleted",
  "meal.changed",
  "calendar.changed",
  "todo.changed",
  "note.changed",
  "shopping.changed",
  "cleaning.changed",
  "annual_cost.changed",
  "data.changed",
  "attachment.changed",
  "permissions.changed",
  "household.changed",
] as const;

export type RealtimeEventType = (typeof REALTIME_EVENTS)[number];

export interface RealtimeEvent {
  householdId: string;
  type: RealtimeEventType;
  resourceId?: string;
  occurredAt: string;
}

export interface PermissionSet {
  moduleKey: ModuleKey;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  userId: string;
  role: HouseholdMemberRole;
  isActive: boolean;
  displayName: string;
}

export interface MoneySummary {
  incomeAmount: string;
  totalBudgetAmount: string;
  totalSpentAmount: string;
  totalRemainingAmount: string;
}

export interface BudgetItemSummary {
  id: string;
  ownerMemberId: string;
  categoryId: string;
  name: string;
  budgetAmount: string | null;
  spentAmount: string;
  remainingAmount: string | null;
  displayOrder: number;
  expenses?: ExpenseSummary[];
}

export interface ExpenseSummary {
  amount: string;
  budgetItemId: string;
  createdAt: string;
  id: string;
  updatedAt: string;
}

export const SHOPPING_CATEGORIES = [
  "Alkohole",
  "Apteczka",
  "Dania gotowe",
  "Dla zwierząt",
  "Dom i ogród",
  "Dziecko",
  "Elektronika",
  "Higiena",
  "Kawa i herbata",
  "Konserwy i przetwory",
  "Mięso i wędliny",
  "Mrożonki",
  "Nabiał i jaja",
  "Owoce, warzywa i zioła",
  "Papiernicze",
  "Pieczenie i dodatki",
  "Pieczywo",
  "Przyprawy, sosy i oleje",
  "Ryby i owoce morza",
  "Słodycze i przekąski",
  "Sypkie",
  "Środki czystości",
  "Ubrania",
  "Wege",
  "Woda i napoje",
  "Inne",
] as const;

export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export interface ShoppingCategoryMeta {
  color: string;
  emoji: string;
  title: ShoppingCategory;
}

export const SHOPPING_CATEGORY_META: Record<
  ShoppingCategory,
  ShoppingCategoryMeta
> = {
  Alkohole: { color: "#8b5cf6", emoji: "🍷", title: "Alkohole" },
  Apteczka: { color: "#ef4444", emoji: "💊", title: "Apteczka" },
  "Dania gotowe": { color: "#f97316", emoji: "🥘", title: "Dania gotowe" },
  "Dla zwierząt": { color: "#a16207", emoji: "🐾", title: "Dla zwierząt" },
  "Dom i ogród": { color: "#16a34a", emoji: "🏡", title: "Dom i ogród" },
  Dziecko: { color: "#ec4899", emoji: "🍼", title: "Dziecko" },
  Elektronika: { color: "#2563eb", emoji: "🔋", title: "Elektronika" },
  Higiena: { color: "#06b6d4", emoji: "🧴", title: "Higiena" },
  Inne: { color: "#64748b", emoji: "🛒", title: "Inne" },
  "Kawa i herbata": { color: "#92400e", emoji: "☕", title: "Kawa i herbata" },
  "Konserwy i przetwory": {
    color: "#d97706",
    emoji: "🥫",
    title: "Konserwy i przetwory",
  },
  "Mięso i wędliny": {
    color: "#dc2626",
    emoji: "🥩",
    title: "Mięso i wędliny",
  },
  Mrożonki: { color: "#0ea5e9", emoji: "🧊", title: "Mrożonki" },
  "Nabiał i jaja": { color: "#facc15", emoji: "🧀", title: "Nabiał i jaja" },
  "Owoce, warzywa i zioła": {
    color: "#22c55e",
    emoji: "🥦",
    title: "Owoce, warzywa i zioła",
  },
  Papiernicze: { color: "#6366f1", emoji: "📒", title: "Papiernicze" },
  "Pieczenie i dodatki": {
    color: "#fb7185",
    emoji: "🧁",
    title: "Pieczenie i dodatki",
  },
  Pieczywo: { color: "#ca8a04", emoji: "🥖", title: "Pieczywo" },
  "Przyprawy, sosy i oleje": {
    color: "#eab308",
    emoji: "🫙",
    title: "Przyprawy, sosy i oleje",
  },
  "Ryby i owoce morza": {
    color: "#0284c7",
    emoji: "🐟",
    title: "Ryby i owoce morza",
  },
  "Słodycze i przekąski": {
    color: "#db2777",
    emoji: "🍫",
    title: "Słodycze i przekąski",
  },
  Sypkie: { color: "#b45309", emoji: "🌾", title: "Sypkie" },
  "Środki czystości": {
    color: "#14b8a6",
    emoji: "🧽",
    title: "Środki czystości",
  },
  Ubrania: { color: "#7c3aed", emoji: "👕", title: "Ubrania" },
  Wege: { color: "#15803d", emoji: "🌱", title: "Wege" },
  "Woda i napoje": { color: "#0891b2", emoji: "🧃", title: "Woda i napoje" },
};

export interface ShoppingProductDefinition {
  aliases?: readonly string[];
  category: ShoppingCategory;
  name: string;
}

function shoppingProduct(
  name: string,
  category: ShoppingCategory,
  aliases: readonly string[] = [],
): ShoppingProductDefinition {
  return { aliases, category, name };
}

export const SHOPPING_PRODUCT_CATALOG = [
  shoppingProduct("mleko", "Nabiał i jaja"),
  shoppingProduct("jajka", "Nabiał i jaja"),
  shoppingProduct("chleb", "Pieczywo"),
  shoppingProduct("papier toaletowy", "Środki czystości"),
  shoppingProduct("woda", "Woda i napoje"),
  shoppingProduct("pomidory", "Owoce, warzywa i zioła", [
    "pomidor",
    "pomidorek",
    "pomidorki",
    "pomidorki koktajlowe",
  ]),
  shoppingProduct("pieczywo", "Pieczywo"),
  shoppingProduct("ser żółty", "Nabiał i jaja"),
  shoppingProduct("piwo", "Alkohole"),
  shoppingProduct("wędlina", "Mięso i wędliny"),
  shoppingProduct("kawa", "Kawa i herbata"),
  shoppingProduct("śmietana", "Nabiał i jaja"),
  shoppingProduct("jogurt", "Nabiał i jaja"),
  shoppingProduct("ketchup", "Przyprawy, sosy i oleje"),
  shoppingProduct("herbata", "Kawa i herbata"),
  shoppingProduct("szampon", "Higiena"),
  shoppingProduct("sok", "Woda i napoje"),
  shoppingProduct("kurczak", "Mięso i wędliny"),
  shoppingProduct("chipsy", "Słodycze i przekąski"),
  shoppingProduct("proszek do prania", "Środki czystości"),
  shoppingProduct("pieluchy", "Dziecko"),
  shoppingProduct("mydło", "Higiena"),
  shoppingProduct("dezodorant", "Higiena"),
  shoppingProduct("parówki", "Mięso i wędliny", ["parowki"]),
  shoppingProduct("mięso", "Mięso i wędliny"),
  shoppingProduct("czekolada", "Słodycze i przekąski"),
  shoppingProduct("pasta do zębów", "Higiena"),
  shoppingProduct("podpaski", "Higiena"),
  shoppingProduct("żel pod prysznic", "Higiena"),
  shoppingProduct("ciastka", "Słodycze i przekąski"),
  shoppingProduct("pampersy", "Dziecko"),
  shoppingProduct("ryż", "Sypkie"),
  shoppingProduct("coca cola", "Woda i napoje", ["cola"]),
  shoppingProduct("ogórek", "Owoce, warzywa i zioła", ["ogorek"]),
  shoppingProduct("makaron", "Sypkie"),
  shoppingProduct("olej", "Przyprawy, sosy i oleje"),
  shoppingProduct("oliwa", "Przyprawy, sosy i oleje"),
  shoppingProduct("przyprawy", "Przyprawy, sosy i oleje"),
  shoppingProduct("cebula", "Owoce, warzywa i zioła"),
  shoppingProduct("płatki śniadaniowe", "Sypkie"),
  shoppingProduct("papryka", "Owoce, warzywa i zioła"),
  shoppingProduct("odżywka", "Higiena"),
  shoppingProduct("ziemniaki", "Owoce, warzywa i zioła"),
  shoppingProduct("majonez", "Przyprawy, sosy i oleje"),
  shoppingProduct("musztarda", "Przyprawy, sosy i oleje"),
  shoppingProduct("łosoś", "Ryby i owoce morza", ["losos"]),
  shoppingProduct("tuńczyk", "Ryby i owoce morza", ["tunczyk"]),
  shoppingProduct("wkładki", "Higiena"),
  shoppingProduct("tampony", "Higiena"),
  shoppingProduct("dżem", "Konserwy i przetwory"),
  shoppingProduct("kiełbasa", "Mięso i wędliny"),
  shoppingProduct("energetyk", "Woda i napoje"),
  shoppingProduct("lody", "Mrożonki"),
  shoppingProduct("chusteczki higieniczne", "Higiena"),
  shoppingProduct("cukier", "Sypkie"),
  shoppingProduct("sałata", "Owoce, warzywa i zioła"),
  shoppingProduct("odświeżacz powietrza", "Środki czystości"),
  shoppingProduct("karma", "Dla zwierząt"),
  shoppingProduct("ser topiony", "Nabiał i jaja"),
  shoppingProduct("banany", "Owoce, warzywa i zioła", ["banan"]),
  shoppingProduct("ser", "Nabiał i jaja"),
  shoppingProduct("pieczarki", "Owoce, warzywa i zioła"),
  shoppingProduct("czosnek", "Owoce, warzywa i zioła"),
  shoppingProduct("szynka", "Mięso i wędliny"),
  shoppingProduct("cytryna", "Owoce, warzywa i zioła"),
  shoppingProduct("owoce", "Owoce, warzywa i zioła"),
  shoppingProduct("pietruszka", "Owoce, warzywa i zioła"),
  shoppingProduct("pieprz", "Przyprawy, sosy i oleje"),
  shoppingProduct("wino", "Alkohole"),
  shoppingProduct("kukurydza", "Konserwy i przetwory"),
  shoppingProduct("woda mineralna", "Woda i napoje"),
  shoppingProduct("szczypiorek", "Owoce, warzywa i zioła"),
  shoppingProduct("por", "Owoce, warzywa i zioła"),
  shoppingProduct("mandarynki", "Owoce, warzywa i zioła", ["mandarynka"]),
  shoppingProduct("koncentrat pomidorowy", "Konserwy i przetwory"),
  shoppingProduct("kakao", "Pieczenie i dodatki"),
  shoppingProduct("boczek", "Mięso i wędliny"),
  shoppingProduct("cukinia", "Owoce, warzywa i zioła"),
  shoppingProduct("seler", "Owoce, warzywa i zioła"),
  shoppingProduct("bazylia", "Owoce, warzywa i zioła"),
  shoppingProduct("natka pietruszki", "Owoce, warzywa i zioła"),
  shoppingProduct("oliwki", "Konserwy i przetwory"),
  shoppingProduct("koperek", "Owoce, warzywa i zioła"),
  shoppingProduct("proszek do pieczenia", "Pieczenie i dodatki"),
  shoppingProduct("winogrona", "Owoce, warzywa i zioła"),
  shoppingProduct("folia aluminiowa", "Dom i ogród"),
  shoppingProduct("burrata", "Nabiał i jaja"),
  shoppingProduct("feta", "Nabiał i jaja"),
  shoppingProduct("frytki", "Mrożonki"),
  shoppingProduct("salami", "Mięso i wędliny"),
  shoppingProduct("kefir", "Nabiał i jaja"),
  shoppingProduct("kasza gryczana", "Sypkie"),
  shoppingProduct("kalafior", "Owoce, warzywa i zioła"),
  shoppingProduct("ziele angielskie", "Przyprawy, sosy i oleje"),
  shoppingProduct("nutella", "Słodycze i przekąski"),
  shoppingProduct("bagietka", "Pieczywo"),
  shoppingProduct("paluszki", "Słodycze i przekąski"),
  shoppingProduct("chrzan", "Przyprawy, sosy i oleje"),
  shoppingProduct("mozzarella", "Nabiał i jaja", ["mozarella", "mozarela"]),
  shoppingProduct("parmezan", "Nabiał i jaja"),
  shoppingProduct("tabletki do zmywarki", "Środki czystości"),
  shoppingProduct("rukola", "Owoce, warzywa i zioła"),
  shoppingProduct("twaróg", "Nabiał i jaja"),
  shoppingProduct("sos sojowy", "Przyprawy, sosy i oleje"),
  shoppingProduct("groszek", "Konserwy i przetwory"),
  shoppingProduct("kiwi", "Owoce, warzywa i zioła"),
  shoppingProduct("kasza", "Sypkie"),
  shoppingProduct("awokado", "Owoce, warzywa i zioła"),
  shoppingProduct("kapusta", "Owoce, warzywa i zioła"),
  shoppingProduct("papier do pieczenia", "Pieczenie i dodatki"),
  shoppingProduct("papierosy", "Inne"),
  shoppingProduct("cif", "Środki czystości"),
  shoppingProduct("antyperspirant", "Higiena"),
  shoppingProduct("zioła prowansalskie", "Przyprawy, sosy i oleje"),
  shoppingProduct("ananas", "Owoce, warzywa i zioła"),
  shoppingProduct("baterie", "Elektronika"),
  shoppingProduct("cukierki", "Słodycze i przekąski"),
  shoppingProduct("seler naciowy", "Owoce, warzywa i zioła"),
  shoppingProduct("herbata owocowa", "Kawa i herbata"),
  shoppingProduct("bułka tarta", "Pieczenie i dodatki"),
  shoppingProduct("fasola", "Wege"),
  shoppingProduct("herbatniki", "Słodycze i przekąski"),
  shoppingProduct("pierogi", "Dania gotowe"),
  shoppingProduct("pomidorki koktajlowe", "Owoce, warzywa i zioła"),
  shoppingProduct("mąka tortowa", "Pieczenie i dodatki"),
  shoppingProduct("soda oczyszczona", "Pieczenie i dodatki"),
  shoppingProduct("kasza jaglana", "Sypkie"),
  shoppingProduct("kminek", "Przyprawy, sosy i oleje"),
  shoppingProduct("czekolada gorzka", "Słodycze i przekąski"),
  shoppingProduct("spaghetti", "Sypkie"),
  shoppingProduct("krem", "Higiena"),
  shoppingProduct("kapary", "Konserwy i przetwory"),
  shoppingProduct("actimel", "Nabiał i jaja"),
  shoppingProduct("krakersy", "Słodycze i przekąski"),
  shoppingProduct("truskawki", "Owoce, warzywa i zioła"),
  shoppingProduct("budyń", "Pieczenie i dodatki"),
  shoppingProduct("paluszki rybne", "Ryby i owoce morza"),
  shoppingProduct("mokre chusteczki", "Higiena"),
  shoppingProduct("białe wino", "Alkohole"),
  shoppingProduct("galaretka", "Pieczenie i dodatki"),
  shoppingProduct("udka z kurczaka", "Mięso i wędliny"),
  shoppingProduct("czarne oliwki", "Konserwy i przetwory"),
  shoppingProduct("ananas w puszce", "Konserwy i przetwory"),
  shoppingProduct("ciasteczka", "Słodycze i przekąski"),
  shoppingProduct("szpinak mrożony", "Mrożonki"),
  shoppingProduct("żelki", "Słodycze i przekąski"),
  shoppingProduct("ocet balsamiczny", "Przyprawy, sosy i oleje"),
  shoppingProduct("witaminy", "Apteczka"),
  shoppingProduct("wiórki kokosowe", "Pieczenie i dodatki"),
  shoppingProduct("balsam", "Higiena"),
  shoppingProduct("otręby", "Sypkie"),
  shoppingProduct("paluszki krabowe", "Ryby i owoce morza"),
  shoppingProduct("brukselka", "Owoce, warzywa i zioła"),
  shoppingProduct("sos do spaghetti", "Przyprawy, sosy i oleje"),
  shoppingProduct("kardamon", "Przyprawy, sosy i oleje"),
  shoppingProduct("wafle", "Słodycze i przekąski"),
  shoppingProduct("czerwona fasola", "Konserwy i przetwory"),
  shoppingProduct("wafelki", "Słodycze i przekąski"),
  shoppingProduct("tort", "Słodycze i przekąski"),
  shoppingProduct("czekolada mleczna", "Słodycze i przekąski"),
  shoppingProduct("suszone grzyby", "Konserwy i przetwory"),
  shoppingProduct("zeszyt", "Papiernicze"),
  shoppingProduct("ser camembert", "Nabiał i jaja"),
  shoppingProduct("suszone śliwki", "Konserwy i przetwory"),
  shoppingProduct("batony", "Słodycze i przekąski"),
  shoppingProduct("wątróbka", "Mięso i wędliny"),
  shoppingProduct("roszponka", "Owoce, warzywa i zioła"),
  shoppingProduct("fasolka szparagowa", "Owoce, warzywa i zioła"),
  shoppingProduct("hamburgery", "Dania gotowe"),
  shoppingProduct("masło orzechowe", "Słodycze i przekąski"),
  shoppingProduct("barszcz", "Dania gotowe"),
  shoppingProduct("ciecierzyca", "Wege"),
  shoppingProduct("mąka", "Sypkie"),
  shoppingProduct("ogórki kiszone", "Konserwy i przetwory"),
  shoppingProduct("olej z pestek winogron", "Przyprawy, sosy i oleje"),
  shoppingProduct("soczewica", "Wege"),
  shoppingProduct("szczoteczka do zębów", "Higiena"),
  shoppingProduct("wino wytrawne", "Alkohole"),
  shoppingProduct("bakłażan", "Owoce, warzywa i zioła"),
  shoppingProduct("brokuły", "Owoce, warzywa i zioła"),
  shoppingProduct("bułki", "Pieczywo"),
  shoppingProduct("jabłka", "Owoce, warzywa i zioła", ["jabłko"]),
  shoppingProduct("kasza jęczmienna", "Sypkie"),
  shoppingProduct("maślanka", "Nabiał i jaja"),
  shoppingProduct("mięso mielone", "Mięso i wędliny"),
  shoppingProduct("migdały", "Sypkie"),
  shoppingProduct("orzechy włoskie", "Sypkie"),
  shoppingProduct("płatki kosmetyczne", "Higiena"),
  shoppingProduct("płatki kukurydziane", "Sypkie"),
  shoppingProduct("płatki owsiane", "Sypkie"),
  shoppingProduct("płyn do mycia naczyń", "Środki czystości"),
  shoppingProduct("płyn do prania", "Środki czystości"),
  shoppingProduct("ręczniki", "Dom i ogród"),
  shoppingProduct("ściereczki", "Środki czystości"),
  shoppingProduct("ser biały", "Nabiał i jaja"),
  shoppingProduct("ser pleśniowy", "Nabiał i jaja"),
  shoppingProduct("słodycze", "Słodycze i przekąski"),
  shoppingProduct("wołowina", "Mięso i wędliny"),
  shoppingProduct("woreczki śniadaniowe", "Dom i ogród"),
  shoppingProduct("worki na śmieci", "Środki czystości"),
  shoppingProduct("wykałaczki", "Dom i ogród"),
  shoppingProduct("żarówki", "Elektronika"),
  shoppingProduct("żwirek", "Dla zwierząt"),
  shoppingProduct("cydr", "Alkohole"),
  shoppingProduct("bandaż", "Apteczka"),
  shoppingProduct("tacki aluminiowe", "Dom i ogród"),
  shoppingProduct("kaszka", "Sypkie"),
  shoppingProduct("liść laurowy", "Przyprawy, sosy i oleje"),
  shoppingProduct("sól", "Przyprawy, sosy i oleje"),
  shoppingProduct("mieszanka studencka", "Słodycze i przekąski"),
  shoppingProduct("zupka chińska", "Dania gotowe"),
  shoppingProduct("kawa zbożowa", "Kawa i herbata"),
  shoppingProduct("kawa rozpuszczalna", "Kawa i herbata"),
  shoppingProduct("konserwa turystyczna", "Konserwy i przetwory"),
  shoppingProduct("mielonka", "Konserwy i przetwory"),
  shoppingProduct("sardynki w puszce", "Ryby i owoce morza"),
  shoppingProduct("woda po goleniu", "Higiena"),
  shoppingProduct("waciki kosmetyczne", "Higiena"),
  shoppingProduct("pasztet", "Konserwy i przetwory"),
  shoppingProduct("pierś z kurczaka", "Mięso i wędliny"),
  shoppingProduct("śledzie w zalewie", "Ryby i owoce morza"),
  shoppingProduct("pierogi mrożone", "Mrożonki"),
  shoppingProduct("pączki", "Pieczywo"),
  shoppingProduct("miód", "Konserwy i przetwory"),
  shoppingProduct("konfitura", "Konserwy i przetwory"),
  shoppingProduct("olej kokosowy", "Przyprawy, sosy i oleje"),
  shoppingProduct("masło", "Nabiał i jaja"),
  shoppingProduct("t-shirt", "Ubrania"),
  shoppingProduct("marchewka", "Owoce, warzywa i zioła"),
  shoppingProduct("arbuz", "Owoce, warzywa i zioła", ["arbuzy"]),
  shoppingProduct("melon", "Owoce, warzywa i zioła", ["melony"]),
  shoppingProduct("mango", "Owoce, warzywa i zioła"),
  shoppingProduct("gruszki", "Owoce, warzywa i zioła", ["gruszka"]),
  shoppingProduct("śliwki", "Owoce, warzywa i zioła", ["śliwka"]),
  shoppingProduct("brzoskwinie", "Owoce, warzywa i zioła", ["brzoskwinia"]),
  shoppingProduct("nektarynki", "Owoce, warzywa i zioła", ["nektarynka"]),
  shoppingProduct("morele", "Owoce, warzywa i zioła", ["morela"]),
  shoppingProduct("maliny", "Owoce, warzywa i zioła", ["malina"]),
  shoppingProduct("jeżyny", "Owoce, warzywa i zioła", ["jeżyna"]),
  shoppingProduct("porzeczki", "Owoce, warzywa i zioła", ["porzeczka"]),
  shoppingProduct("agrest", "Owoce, warzywa i zioła"),
  shoppingProduct("grejpfrut", "Owoce, warzywa i zioła", ["grejpfruty"]),
  shoppingProduct("limonka", "Owoce, warzywa i zioła", ["limonki"]),
  shoppingProduct("granat", "Owoce, warzywa i zioła", ["granaty"]),
  shoppingProduct("marakuja", "Owoce, warzywa i zioła", ["marakuje"]),
  shoppingProduct("papaja", "Owoce, warzywa i zioła"),
  shoppingProduct("kaki", "Owoce, warzywa i zioła"),
  shoppingProduct("żurawina", "Owoce, warzywa i zioła"),
  shoppingProduct("rabarbar", "Owoce, warzywa i zioła"),
  shoppingProduct("rzodkiewki", "Owoce, warzywa i zioła", ["rzodkiewka"]),
  shoppingProduct("dynia", "Owoce, warzywa i zioła", ["dynie"]),
  shoppingProduct("bataty", "Owoce, warzywa i zioła", ["batat"]),
  shoppingProduct("jarmuż", "Owoce, warzywa i zioła"),
  shoppingProduct("botwina", "Owoce, warzywa i zioła"),
  shoppingProduct("boćwina", "Owoce, warzywa i zioła"),
  shoppingProduct("pasternak", "Owoce, warzywa i zioła"),
  shoppingProduct("rzepa", "Owoce, warzywa i zioła"),
  shoppingProduct("kalarepa", "Owoce, warzywa i zioła"),
  shoppingProduct("koper włoski", "Owoce, warzywa i zioła", ["fenkuł"]),
  shoppingProduct("cykoria", "Owoce, warzywa i zioła"),
  shoppingProduct("endywia", "Owoce, warzywa i zioła"),
  shoppingProduct("topinambur", "Owoce, warzywa i zioła"),
  shoppingProduct("groszek cukrowy", "Owoce, warzywa i zioła"),
  shoppingProduct("kolendra", "Owoce, warzywa i zioła"),
  shoppingProduct("mięta", "Owoce, warzywa i zioła"),
  shoppingProduct("rozmaryn", "Owoce, warzywa i zioła"),
  shoppingProduct("tymianek", "Owoce, warzywa i zioła"),
  shoppingProduct("szałwia", "Owoce, warzywa i zioła"),
  shoppingProduct("oregano", "Owoce, warzywa i zioła"),
  shoppingProduct("lubczyk", "Owoce, warzywa i zioła"),
  shoppingProduct("estragon", "Owoce, warzywa i zioła"),
  shoppingProduct("kurki", "Owoce, warzywa i zioła", ["kurka"]),
  shoppingProduct("prawdziwki", "Owoce, warzywa i zioła", ["prawdziwek"]),
  shoppingProduct("podgrzybki", "Owoce, warzywa i zioła", ["podgrzybek"]),
  shoppingProduct("pomarańcze", "Owoce, warzywa i zioła", ["pomarańcza"]),
  shoppingProduct("buraki", "Owoce, warzywa i zioła", ["burak"]),
  shoppingProduct("szparagi", "Owoce, warzywa i zioła"),
  shoppingProduct("borówki", "Owoce, warzywa i zioła", ["borówka"]),
  shoppingProduct("napój izotoniczny", "Woda i napoje"),
  shoppingProduct("ciastka owsiane", "Słodycze i przekąski"),
  shoppingProduct("aspiryna", "Apteczka"),
  shoppingProduct("owsianka", "Sypkie"),
  shoppingProduct("cynamon", "Przyprawy, sosy i oleje"),
  shoppingProduct("ocet jabłkowy", "Przyprawy, sosy i oleje"),
  shoppingProduct("zioła", "Przyprawy, sosy i oleje"),
  shoppingProduct("pizza", "Dania gotowe"),
  shoppingProduct("guma do żucia", "Słodycze i przekąski"),
  shoppingProduct("rodzynki", "Słodycze i przekąski"),
  shoppingProduct("karczochy", "Konserwy i przetwory", ["karczoch"]),
  shoppingProduct("wiśnie", "Owoce, warzywa i zioła", ["wiśnia"]),
  shoppingProduct("daktyle", "Słodycze i przekąski"),
  shoppingProduct("tuńczyk w puszce", "Ryby i owoce morza"),
  shoppingProduct("hummus", "Wege"),
  shoppingProduct("tofu", "Wege"),
  shoppingProduct("ręczniki papierowe", "Środki czystości"),
  shoppingProduct("patyczki higieniczne", "Higiena"),
  shoppingProduct("filet", "Mięso i wędliny"),
  shoppingProduct("skrzydełka z kurczaka", "Mięso i wędliny"),
  shoppingProduct("baton zbożowy", "Słodycze i przekąski"),
  shoppingProduct("mrożone warzywa", "Mrożonki"),
  shoppingProduct("kapusta kiszona", "Konserwy i przetwory"),
  shoppingProduct("mus jabłkowy", "Konserwy i przetwory"),
  shoppingProduct("czarny pieprz", "Przyprawy, sosy i oleje"),
  shoppingProduct("jagody", "Owoce, warzywa i zioła", ["jagoda"]),
  shoppingProduct("czerwone wino", "Alkohole"),
  shoppingProduct("anchois", "Ryby i owoce morza"),
  shoppingProduct("bajgle", "Pieczywo", ["bajgiel"]),
  shoppingProduct("balsam po goleniu", "Higiena"),
  shoppingProduct("chipsy tortilla", "Słodycze i przekąski"),
  shoppingProduct("chusteczki dla niemowląt", "Dziecko"),
  shoppingProduct("ciasto w proszku", "Pieczenie i dodatki"),
  shoppingProduct("czarne porzeczki", "Owoce, warzywa i zioła", [
    "czarna porzeczka",
  ]),
  shoppingProduct("guacamole", "Wege"),
  shoppingProduct("kwas cytrynowy", "Pieczenie i dodatki"),
  shoppingProduct("lek na biegunkę", "Apteczka"),
  shoppingProduct("lemoniada", "Woda i napoje"),
  shoppingProduct("lukier", "Pieczenie i dodatki"),
  shoppingProduct("małe marchewki", "Owoce, warzywa i zioła"),
  shoppingProduct("orzechy nerkowca", "Sypkie"),
  shoppingProduct("papryczka chili", "Owoce, warzywa i zioła"),
  shoppingProduct("plastry z opatrunkiem", "Apteczka"),
  shoppingProduct("pomidory krojone", "Konserwy i przetwory"),
  shoppingProduct("przyprawa curry", "Przyprawy, sosy i oleje"),
  shoppingProduct("pure ziemniaczane", "Dania gotowe"),
  shoppingProduct("rosół wołowy", "Dania gotowe"),
  shoppingProduct("ser cheddar", "Nabiał i jaja"),
  shoppingProduct("sos barbecue", "Przyprawy, sosy i oleje"),
  shoppingProduct("sos tzatziki", "Przyprawy, sosy i oleje"),
  shoppingProduct("suszona żurawina", "Słodycze i przekąski"),
  shoppingProduct("świece", "Dom i ogród"),
  shoppingProduct("tortille pszenne", "Pieczywo"),
  shoppingProduct("żel do kąpieli", "Higiena"),
  shoppingProduct("bób", "Wege"),
  shoppingProduct("smaczki dla kota", "Dla zwierząt"),
  shoppingProduct("smaczki dla psa", "Dla zwierząt"),
  shoppingProduct("zatyczki do uszu", "Higiena"),
  shoppingProduct("falafel", "Wege"),
  shoppingProduct("słuchawki", "Elektronika"),
  shoppingProduct("boczniaki", "Owoce, warzywa i zioła"),
  shoppingProduct("ser żółty w plastrach", "Nabiał i jaja"),
  shoppingProduct("papryka wędzona", "Przyprawy, sosy i oleje"),
  shoppingProduct("bakalie", "Słodycze i przekąski"),
] as const satisfies readonly ShoppingProductDefinition[];

interface ShoppingKeywordRule {
  category: ShoppingCategory;
  pattern: RegExp;
}

const SHOPPING_CATEGORY_BY_NORMALIZED = new Map(
  SHOPPING_CATEGORIES.map(
    (category) => [normalizeShoppingText(category), category] as const,
  ),
);

const SHOPPING_PRODUCT_CATEGORY_BY_NAME = new Map<string, ShoppingCategory>(
  SHOPPING_PRODUCT_CATALOG.flatMap((item) => {
    const terms = [item.name, ...(item.aliases ?? [])];

    return terms.map(
      (term) => [normalizeShoppingText(term), item.category] as const,
    );
  }),
);

const SHOPPING_PRODUCT_SEARCH_INDEX = SHOPPING_PRODUCT_CATALOG.map((item) => ({
  item,
  terms: [item.name, ...(item.aliases ?? [])].map(normalizeShoppingText),
}));

const SHOPPING_CATEGORY_KEYWORD_RULES: readonly ShoppingKeywordRule[] = [
  {
    category: "Alkohole",
    pattern: /\b(piwo|wino|alkohol|wodka|whisky|prosecco)\b/,
  },
  {
    category: "Apteczka",
    pattern: /\b(witamin|lek|tablet|syrop|aptecz|plastry|termometr)\b/,
  },
  {
    category: "Dania gotowe",
    pattern: /\b(pierog|hamburger|pizza|barszcz|zupa|gotow)\b/,
  },
  { category: "Dla zwierząt", pattern: /\b(karma|zwierzat|psa|kota|kuwet)\b/ },
  {
    category: "Dom i ogród",
    pattern: /\b(folia|ogrod|grill|worki|znicz|donicz)\b/,
  },
  {
    category: "Dziecko",
    pattern: /\b(pieluch|pampers|dzieck|niemowl|chusteczki mokre)\b/,
  },
  {
    category: "Elektronika",
    pattern: /\b(bateri|ladowark|kabel|zarowk|usb)\b/,
  },
  {
    category: "Higiena",
    pattern:
      /\b(szampon|mydl|dezodor|pasta|szczotecz|podpask|tampon|wkladk|zel|krem|balsam|kosmet|higien|antyperspir|odzywk|chustecz|platki kosmetyczne)\b/,
  },
  { category: "Kawa i herbata", pattern: /\b(kawa|herbat|matcha)\b/ },
  {
    category: "Konserwy i przetwory",
    pattern:
      /\b(dzem|koncentrat|oliwk|groszek|kukurydz|puszc|konserw|kapar|fasola czerwona|ogorki kiszone|suszone grzyb|suszone sliwk)\b/,
  },
  {
    category: "Mięso i wędliny",
    pattern:
      /\b(kurczak|indyk|wolow|wieprz|mieso|wedlin|szynk|kielbas|parowk|boczek|salami|watrob|mielone|prosciutto)\b/,
  },
  { category: "Mrożonki", pattern: /\b(mrozon|lody|frytki)\b/ },
  {
    category: "Nabiał i jaja",
    pattern:
      /\b(mleko|jaj|jogurt|kefir|maslank|ser|twarog|serek|maslo|smietan|mozzarell|mozarell|feta|burrat|skyr|actimel|camembert)\b/,
  },
  {
    category: "Owoce, warzywa i zioła",
    pattern:
      /\b(?:(?:pomidor|pomidork|ogork|salat|papryk|marchew|ziemni|cebul|czosn|warzyw|brokul|kalaf|kapust|cukini|awokad|pieczark|boczniak|rukol|szpinak|banan|jabl|granat|grusz|cytryn|limonk|owoc|truskawk|malin|borow|jagod|winogron|pomarancz|mandaryn|pietruszk|szczypior|seler|bazyli|koper|ananas|baklazan|roszpon|bruksel|fasolk|arbuz|melon|sliw|brzoskw|nektaryn|morel|jezyn|porzecz|agrest|grejpfr|marakuj|papaj|zurawin|rabarbar|rzodkiew|dyni|batat|jarmuz|botwin|bocwin|pasternak|rzep|kalarep|fenkul|cykori|endywi|topinambur|kolendr|miet|rozmaryn|tymian|szalwi|oregano|lubczyk|estragon|prawdziw|podgrzyb)[a-z]*|kiwi|mango|kaki|por|kurki?)\b/,
  },
  {
    category: "Papiernicze",
    pattern: /\b(zeszyt|dlugopis|olowek|papiernicz|blok|notes)\b/,
  },
  {
    category: "Pieczenie i dodatki",
    pattern:
      /\b(kakao|proszek do pieczenia|maka tortowa|soda|budyn|galaretk|wiork|bulka tarta|papier do pieczenia)\b/,
  },
  {
    category: "Pieczywo",
    pattern:
      /\b(chleb|bulka|bulki|bagiet|kajzer|tost|pieczyw|croissant|drozdz)\b/,
  },
  {
    category: "Przyprawy, sosy i oleje",
    pattern:
      /\b(ketchup|olej|oliw|przypraw|majonez|musztard|pieprz|chrzan|sos|ocet|kminek|kardamon|ziele angielskie|pesto)\b/,
  },
  {
    category: "Ryby i owoce morza",
    pattern: /\b(ryb|losos|tunczyk|dorsz|sledz|krab|krewet)\b/,
  },
  {
    category: "Słodycze i przekąski",
    pattern:
      /\b(czekolad|ciast|baton|chips|chrupk|palusz|cukierk|zelk|przekask|deser|nutell|krakers|herbatnik|wafel|tort|maslo orzechowe)\b/,
  },
  {
    category: "Sypkie",
    pattern:
      /\b(makaron|ryz|kasz|maka|cukier|sol|platk|musli|otreby|spaghetti|migdal|orzech)\b/,
  },
  {
    category: "Środki czystości",
    pattern:
      /\b(plyn|proszek do prania|kapsulk|zmywark|prani|papier toaletowy|recznik|gabka|scierk|mop|chemia|sprzat|odkamieniacz|cif|odswiezacz)\b/,
  },
  {
    category: "Ubrania",
    pattern: /\b(ubran|koszul|spodn|skarpet|buty|czapk)\b/,
  },
  { category: "Wege", pattern: /\b(ciecierzyc|soczewic|tofu|wege|fasola)\b/ },
  {
    category: "Woda i napoje",
    pattern: /\b(woda|sok|napoj|cola|pepsi|energetyk|smoothie|mineralna)\b/,
  },
];

export function normalizeShoppingText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("pl-PL")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

export function isShoppingCategory(
  value: string | null | undefined,
): value is ShoppingCategory {
  return Boolean(
    value && SHOPPING_CATEGORY_BY_NORMALIZED.has(normalizeShoppingText(value)),
  );
}

export function getShoppingCategoryMeta(
  value: string | null | undefined,
): ShoppingCategoryMeta {
  const category =
    value && SHOPPING_CATEGORY_BY_NORMALIZED.get(normalizeShoppingText(value))
      ? SHOPPING_CATEGORY_BY_NORMALIZED.get(normalizeShoppingText(value))
      : "Inne";

  return SHOPPING_CATEGORY_META[category ?? "Inne"];
}

export function categorizeShoppingProduct(value: string): ShoppingCategory {
  const normalized = normalizeShoppingText(value);

  if (!normalized) {
    return "Inne";
  }

  const catalogCategory = SHOPPING_PRODUCT_CATEGORY_BY_NAME.get(normalized);

  if (catalogCategory) {
    return catalogCategory;
  }

  return (
    SHOPPING_CATEGORY_KEYWORD_RULES.find((rule) =>
      rule.pattern.test(normalized),
    )?.category ?? "Inne"
  );
}

export function getShoppingProductSuggestions(
  query: string,
  limit = 8,
): ShoppingProductDefinition[] {
  const normalized = normalizeShoppingText(query);

  if (!normalized) {
    return [];
  }

  const startsWithMatches: ShoppingProductDefinition[] = [];
  const containsMatches: ShoppingProductDefinition[] = [];
  const seen = new Set<string>();

  for (const entry of SHOPPING_PRODUCT_SEARCH_INDEX) {
    const startsWith = entry.terms.some((term) => term.startsWith(normalized));
    const contains =
      startsWith || entry.terms.some((term) => term.includes(normalized));

    if (!contains || seen.has(entry.item.name)) {
      continue;
    }

    seen.add(entry.item.name);

    if (startsWith) {
      startsWithMatches.push(entry.item);
    } else {
      containsMatches.push(entry.item);
    }

    if (startsWithMatches.length >= limit) {
      break;
    }
  }

  return [...startsWithMatches, ...containsMatches].slice(0, limit);
}
