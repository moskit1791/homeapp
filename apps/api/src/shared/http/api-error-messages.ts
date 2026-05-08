import { HttpStatus } from "@nestjs/common";

const exactMessages: Record<string, string> = {
  "Account is banned": "Konto jest zablokowane.",
  "Active invitation already exists for this email":
    "Aktywne zaproszenie dla tego adresu e-mail juz istnieje.",
  "Annual cost name is required": "Podaj nazwe kosztu rocznego.",
  "Annual cost not found": "Nie znaleziono kosztu rocznego.",
  "Attachment fileName is required": "Podaj nazwe pliku.",
  "Attachment not found": "Nie znaleziono zalacznika.",
  "Bad request": "Nieprawidlowe zadanie.",
  "Budget category is not active in household":
    "Kategoria budzetowa nie jest aktywna w tym domu.",
  "Budget category name is required": "Podaj nazwe kategorii budzetu.",
  "Budget category not found": "Nie znaleziono kategorii budzetu.",
  "Budget item is not editable in current month":
    "Tej pozycji budzetu nie mozna edytowac w aktualnym miesiacu.",
  "Budget item name is required": "Podaj nazwe pozycji budzetu.",
  "Budget item not found": "Nie znaleziono pozycji budzetu.",
  "Budget month is not current": "Wybrany miesiac budzetu nie jest aktualny.",
  "Budget owner member is not active in household":
    "Wybrany wlasciciel budzetu nie jest aktywnym domownikiem.",
  "Calendar event not found": "Nie znaleziono wydarzenia.",
  "Calendar event title is required": "Podaj tytul wydarzenia.",
  "Cleaning task name is required": "Podaj nazwe zadania sprzatania.",
  "Cleaning task not found": "Nie znaleziono zadania sprzatania.",
  "Cannot delete the only budget month":
    "Nie mozna usunac jedynego miesiaca budzetowego.",
  "Current budget month not found":
    "Nie znaleziono aktualnego miesiaca budzetowego.",
  "Data entry title is required": "Podaj tytul wpisu.",
  "Data entry not found": "Nie znaleziono wpisu danych.",
  "Dane sa nieprawidlowe.": "Dane sa nieprawidlowe.",
  "Database validation failed": "Dane nie spelniaja ograniczen bazy.",
  "Email delivery failed": "Nie udalo sie wyslac wiadomosci e-mail.",
  "Email is not verified": "Adres e-mail nie zostal potwierdzony.",
  Forbidden: "Brak uprawnien.",
  "Google OAuth requires GOOGLE_OAUTH_CLIENT_ID":
    "Logowanie Google nie jest jeszcze skonfigurowane.",
  "Household not found": "Nie znaleziono domu.",
  "Income owner member is not active in household":
    "Wybrany wlasciciel dochodu nie jest aktywnym domownikiem.",
  "Internal server error": "Wystapil wewnetrzny blad serwera.",
  "Invalid access token": "Token dostepu jest nieprawidlowy.",
  "Invalid attachment storage path": "Sciezka zalacznika jest nieprawidlowa.",
  "Invalid credentials": "Nieprawidlowy e-mail lub haslo.",
  "Invalid date": "Data jest nieprawidlowa.",
  "Invalid Google token": "Token Google jest nieprawidlowy.",
  "Invalid invitation token": "Token zaproszenia jest nieprawidlowy.",
  "Invalid or expired reset token":
    "Token resetu jest nieprawidlowy albo wygasl.",
  "Invalid or expired verification token":
    "Token weryfikacji jest nieprawidlowy albo wygasl.",
  "Invalid recurrence rule": "Regula powtarzania jest nieprawidlowa.",
  "Invalid refresh token": "Token odswiezania jest nieprawidlowy.",
  "Invitation belongs to another email address":
    "Zaproszenie jest przypisane do innego adresu e-mail.",
  "Invitation has already been accepted":
    "Zaproszenie zostalo juz zaakceptowane.",
  "Invitation has expired": "Zaproszenie wygaslo.",
  "Meal idea not found": "Nie znaleziono pomyslu na posilek.",
  "Meal plan not found": "Nie znaleziono planu posilkow.",
  "Meal plan week already exists":
    "Plan posilkow dla tego tygodnia juz istnieje.",
  "Meal plan week must start on Monday":
    "Tydzien planu posilkow musi zaczynac sie w poniedzialek.",
  "Meal slot index exceeds household meal slots per day":
    "Wybrany slot posilku przekracza limit slotow w domu.",
  "Member not found": "Nie znaleziono domownika.",
  "Missing bearer token": "Brak tokenu autoryzacji.",
  "Missing household context": "Brak aktywnego domu.",
  "Missing module permission": "Brak uprawnienia do modulu.",
  "Missing user context": "Brak kontekstu uzytkownika.",
  "Next budget month already exists": "Kolejny miesiac budzetowy juz istnieje.",
  "No access": "Brak dostepu.",
  "No annual cost fields to update":
    "Brak danych kosztu rocznego do aktualizacji.",
  "No attachment fields to update": "Brak danych zalacznika do aktualizacji.",
  "No budget category fields to update":
    "Brak danych kategorii budzetu do aktualizacji.",
  "No budget item fields to update":
    "Brak danych pozycji budzetu do aktualizacji.",
  "No calendar event fields to update":
    "Brak danych wydarzenia do aktualizacji.",
  "No cleaning task fields to update":
    "Brak danych zadania sprzatania do aktualizacji.",
  "No data entry fields to update": "Brak danych wpisu do aktualizacji.",
  "No meal idea fields to update":
    "Brak danych pomyslu na posilek do aktualizacji.",
  "Note not found": "Nie znaleziono notatki.",
  "Not found": "Nie znaleziono zasobu.",
  "Only the household owner can invite members":
    "Tylko wlasciciel domu moze zapraszac domownikow.",
  "Owner member must be an active household member":
    "Wlasciciel musi byc aktywnym domownikiem.",
  "Owner permissions are implicit and cannot be edited":
    "Uprawnienia wlasciciela sa domyslne i nie mozna ich edytowac.",
  "Owner account cannot be deleted while other household members exist":
    "Nie mozna usunac konta wlasciciela, gdy w domu sa inni domownicy.",
  "Recurrence COUNT is too large": "Liczba powtorzen jest zbyt duza.",
  "Recurrence INTERVAL is too large": "Interwal powtarzania jest zbyt duzy.",
  "Recurrence rule requires FREQ=DAILY, WEEKLY or MONTHLY":
    "Regula powtarzania wymaga FREQ=DAILY, WEEKLY albo MONTHLY.",
  "Recurrence UNTIL must be YYYY-MM-DD":
    "Data konca powtarzania musi miec format YYYY-MM-DD.",
  "Referenced resource does not exist": "Powiazany zasob nie istnieje.",
  "Request failed": "Zadanie nie powiodlo sie.",
  "Resource already exists": "Taki zasob juz istnieje.",
  "Shopping item not found": "Nie znaleziono produktu na liscie zakupow.",
  "SMTP_HOST is not configured": "SMTP_HOST nie jest skonfigurowany.",
  "Source meal plan not found": "Nie znaleziono zrodlowego planu posilkow.",
  "Todo item not found": "Nie znaleziono zadania.",
  "Too many auth requests. Try again later.":
    "Zbyt wiele prob logowania. Sprobuj ponownie pozniej.",
  "Too many requests": "Zbyt wiele zadan. Sprobuj ponownie pozniej.",
  Unauthorized: "Brak autoryzacji.",
  "User already belongs to a household": "Uzytkownik nalezy juz do domu.",
  "User has no active household": "Uzytkownik nie ma aktywnego domu.",
  "User is already an active household member":
    "Uzytkownik jest juz aktywnym domownikiem.",
  "User is not registered locally":
    "Uzytkownik nie jest zarejestrowany lokalnie.",
  "Validation failed": "Dane sa nieprawidlowe.",
  "weekday and slotIndex must be provided together":
    "Dzien tygodnia i slot posilku musza byc podane razem.",
};

export function translateApiMessage(
  message: string,
  statusCode?: number,
): string {
  const normalized = message.trim();
  const exact = exactMessages[normalized];

  if (exact) {
    return exact;
  }

  return (
    translatePattern(normalized) ??
    defaultPolishMessageForStatus(statusCode) ??
    normalized
  );
}

export function translateValidationMessage(
  message: string,
  field?: string,
): string {
  const normalized = message.trim();
  const exact = exactMessages[normalized];

  if (exact) {
    return exact;
  }

  return translatePattern(normalized, field) ?? normalized;
}

export function translateApiDetails(details: unknown): unknown {
  if (typeof details === "string") {
    return translateValidationMessage(details);
  }

  if (Array.isArray(details)) {
    return details.map((item) => translateApiDetails(item));
  }

  if (!isRecord(details)) {
    return details;
  }

  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => {
      if (key === "messages" && Array.isArray(value)) {
        return [
          key,
          value.map((item) =>
            typeof item === "string"
              ? translateValidationMessage(item, getField(details))
              : item,
          ),
        ];
      }

      return [key, translateApiDetails(value)];
    }),
  );
}

export function defaultPolishMessageForStatus(
  statusCode: number | undefined,
): string | undefined {
  switch (statusCode) {
    case HttpStatus.BAD_REQUEST:
      return "Nieprawidlowe zadanie.";
    case HttpStatus.UNAUTHORIZED:
      return "Brak autoryzacji.";
    case HttpStatus.FORBIDDEN:
      return "Brak uprawnien.";
    case HttpStatus.NOT_FOUND:
      return "Nie znaleziono zasobu.";
    case HttpStatus.CONFLICT:
      return "Konflikt danych.";
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return "Nie mozna przetworzyc danych.";
    case HttpStatus.TOO_MANY_REQUESTS:
      return "Zbyt wiele zadan. Sprobuj ponownie pozniej.";
    default:
      return statusCode && statusCode >= 500
        ? "Wystapil wewnetrzny blad serwera."
        : undefined;
  }
}

function translatePattern(message: string, field?: string): string | undefined {
  const label = field ? `Pole "${field}"` : "Pole";
  const minLength = message.match(
    /^[\w.]+ must be longer than or equal to (\d+) characters$/,
  );
  const maxLength = message.match(
    /^[\w.]+ must be shorter than or equal to (\d+) characters$/,
  );
  const positiveInteger = message.match(
    /^Recurrence ([A-Z]+) must be a positive integer$/,
  );
  const required = message.match(/^(.+) is required$/);

  if (
    message.startsWith("property ") &&
    message.endsWith(" should not exist")
  ) {
    const property = message
      .replace(/^property /, "")
      .replace(/ should not exist$/, "");

    return `Pole "${property}" nie jest dozwolone.`;
  }

  if (minLength) {
    return `${label} musi miec co najmniej ${minLength[1]} znaki.`;
  }

  if (maxLength) {
    return `${label} moze miec maksymalnie ${maxLength[1]} znakow.`;
  }

  if (/^[\w.]+ must be an email$/.test(message)) {
    return `${label} musi byc poprawnym adresem e-mail.`;
  }

  if (/^[\w.]+ must be a string$/.test(message)) {
    return `${label} musi byc tekstem.`;
  }

  if (/^[\w.]+ must be a number/.test(message)) {
    return `${label} musi byc liczba.`;
  }

  if (/^[\w.]+ must not be less than/.test(message)) {
    return `${label} ma zbyt mala wartosc.`;
  }

  if (/^[\w.]+ must not be greater than/.test(message)) {
    return `${label} ma zbyt duza wartosc.`;
  }

  if (positiveInteger) {
    return `Parametr powtarzania ${positiveInteger[1]} musi byc dodatnia liczba calkowita.`;
  }

  if (required) {
    return `Pole "${required[1]}" jest wymagane.`;
  }

  return undefined;
}

function getField(value: Record<string, unknown>): string | undefined {
  return typeof value.field === "string" ? value.field : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
