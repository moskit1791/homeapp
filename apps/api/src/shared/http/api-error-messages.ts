import { HttpStatus } from "@nestjs/common";

const exactMessages: Record<string, string> = {
  "Account is banned": "Konto jest zablokowane.",
  "Active invitation already exists for this email":
    "Aktywne zaproszenie dla tego adresu e-mail już istnieje.",
  "Annual cost name is required": "Podaj nazwę kosztu rocznego.",
  "Annual cost not found": "Nie znaleziono kosztu rocznego.",
  "Attachment fileName is required": "Podaj nazwę pliku.",
  "Attachment not found": "Nie znaleziono załącznika.",
  "Bad request": "Nieprawidłowe zadanie.",
  "Budget category is not active in household":
    "Kategoria budżetowa nie jest aktywna w tym domu.",
  "Budget category name is required": "Podaj nazwę kategorii budżetu.",
  "Budget category not found": "Nie znaleziono kategorii budżetu.",
  "Budget item is not editable in current month":
    "Tej pozycji budżetu nie można edytować w aktualnym miesiącu.",
  "Budget item name is required": "Podaj nazwę pozycji budżetu.",
  "Budget item not found": "Nie znaleziono pozycji budżetu.",
  "Budget month is not current": "Wybrany miesiąc budżetu nie jest aktualny.",
  "Budget owner member is not active in household":
    "Wybrany właściciel budżetu nie jest aktywnym domownikiem.",
  "Calendar event not found": "Nie znaleziono wydarzenia.",
  "Calendar event title is required": "Podaj tytuł wydarzenia.",
  "Cleaning task name is required": "Podaj nazwę zadania sprzątania.",
  "Cleaning task not found": "Nie znaleziono zadania sprzątania.",
  "Cannot delete the only budget month":
    "Nie można usunąć jedynego miesiąca budżetowego.",
  "Current budget month not found":
    "Nie znaleziono aktualnego miesiąca budżetowego.",
  "Data entry title is required": "Podaj tytuł wpisu.",
  "Data entry not found": "Nie znaleziono wpisu danych.",
  "Dane sa nieprawidlowe.": "Dane są nieprawidłowe.",
  "Dane są nieprawidłowe.": "Dane są nieprawidłowe.",
  "Database validation failed": "Dane nie spełniają ograniczeń bazy.",
  "Email delivery failed": "Nie udało się wysłać wiadomości e-mail.",
  "Email is not verified": "Adres e-mail nie został potwierdzony.",
  Forbidden: "Brak uprawnień.",
  "Google OAuth requires GOOGLE_OAUTH_CLIENT_ID":
    "Logowanie Google nie jest jeszcze skonfigurowane.",
  "Household not found": "Nie znaleziono domu.",
  "Income owner member is not active in household":
    "Wybrany właściciel dochodu nie jest aktywnym domownikiem.",
  "Internal server error": "Wystąpił wewnętrzny błąd serwera.",
  "Invalid access token": "Token dostępu jest nieprawidłowy.",
  "Invalid attachment storage path": "Ścieżka załącznika jest nieprawidłowa.",
  "Invalid credentials": "Nieprawidłowy e-mail lub hasło.",
  "Invalid date": "Data jest nieprawidłowa.",
  "Invalid Google token": "Token Google jest nieprawidłowy.",
  "Invalid invitation token": "Token zaproszenia jest nieprawidłowy.",
  "Invalid or expired reset token":
    "Token resetu jest nieprawidłowy albo wygasł.",
  "Invalid or expired verification token":
    "Token weryfikacji jest nieprawidłowy albo wygasł.",
  "Invalid recurrence rule": "Reguła powtarzania jest nieprawidłowa.",
  "Invalid refresh token": "Token odświeżania jest nieprawidłowy.",
  "Invitation belongs to another email address":
    "Zaproszenie jest przypisane do innego adresu e-mail.",
  "Invitation has already been accepted":
    "Zaproszenie zostało już zaakceptowane.",
  "Invitation has expired": "Zaproszenie wygasło.",
  "Meal idea not found": "Nie znaleziono pomysłu na posiłek.",
  "Meal plan not found": "Nie znaleziono planu posiłków.",
  "Meal plan week already exists":
    "Plan posiłków dla tego tygodnia już istnieje.",
  "Meal plan week must start on Monday":
    "Tydzień planu posiłków musi zaczynać się w poniedziałek.",
  "Meal slot index exceeds household meal slots per day":
    "Wybrany slot posiłku przekracza limit slotów w domu.",
  "Member not found": "Nie znaleziono domownika.",
  "Missing bearer token": "Brak tokenu autoryzacji.",
  "Missing household context": "Brak aktywnego domu.",
  "Missing module permission": "Brak uprawnienia do modułu.",
  "Missing user context": "Brak kontekstu użytkownika.",
  "Next budget month already exists": "Kolejny miesiąc budżetowy już istnieje.",
  "No access": "Brak dostępu.",
  "No annual cost fields to update":
    "Brak danych kosztu rocznego do aktualizacji.",
  "No attachment fields to update": "Brak danych załącznika do aktualizacji.",
  "No budget category fields to update":
    "Brak danych kategorii budżetu do aktualizacji.",
  "No budget item fields to update":
    "Brak danych pozycji budżetu do aktualizacji.",
  "No calendar event fields to update":
    "Brak danych wydarzenia do aktualizacji.",
  "No cleaning task fields to update":
    "Brak danych zadania sprzątania do aktualizacji.",
  "No data entry fields to update": "Brak danych wpisu do aktualizacji.",
  "No meal idea fields to update":
    "Brak danych pomysłu na posiłek do aktualizacji.",
  "Note not found": "Nie znaleziono notatki.",
  "Not found": "Nie znaleziono zasobu.",
  "Only the household owner can invite members":
    "Tylko właściciel domu może zapraszać domowników.",
  "Owner member must be an active household member":
    "Właściciel musi być aktywnym domownikiem.",
  "Owner permissions are implicit and cannot be edited":
    "Uprawnienia właściciela są domyślne i nie można ich edytować.",
  "Owner account cannot be deleted while other household members exist":
    "Nie można usunąć konta właściciela, gdy w domu są inni domownicy.",
  "Recurrence COUNT is too large": "Liczba powtórzeń jest zbyt duża.",
  "Recurrence INTERVAL is too large": "Interwał powtarzania jest zbyt duży.",
  "Recurrence rule requires FREQ=DAILY, WEEKLY or MONTHLY":
    "Reguła powtarzania wymaga FREQ=DAILY, WEEKLY albo MONTHLY.",
  "Recurrence UNTIL must be YYYY-MM-DD":
    "Data końca powtarzania musi mieć format YYYY-MM-DD.",
  "Referenced resource does not exist": "Powiązany zasób nie istnieje.",
  "Request failed": "Zadanie nie powiodło się.",
  "Resource already exists": "Taki zasób już istnieje.",
  "Shopping item not found": "Nie znaleziono produktu na liście zakupów.",
  "Shopping AI empty list": "Wklej listę zakupów do uporządkowania.",
  "Shopping AI is not configured":
    "AI zakupów nie jest jeszcze skonfigurowane na backendzie.",
  "Shopping AI needs clarification":
    "Doprecyzuj listę zakupów, żebym niczego nie zgubił.",
  "Shopping AI request failed":
    "Nie udało się połączyć z Gemini. Spróbuj ponownie za chwilę.",
  "Shopping AI request timed out":
    "Gemini odpowiada za długo. Spróbuj ponownie za chwilę.",
  "Shopping AI returned invalid response":
    "Gemini zwróciło nieprawidłową odpowiedź. Spróbuj ponownie.",
  "SMTP_HOST is not configured": "SMTP_HOST nie jest skonfigurowany.",
  "Source meal plan not found": "Nie znaleziono źródłowego planu posiłków.",
  "Todo item not found": "Nie znaleziono zadania.",
  "Too many auth requests. Try again later.":
    "Zbyt wiele prób logowania. Spróbuj ponownie później.",
  "Too many requests": "Zbyt wiele zadań. Spróbuj ponownie później.",
  Unauthorized: "Brak autoryzacji.",
  "User already belongs to a household": "Użytkownik należy już do domu.",
  "User has no active household": "Użytkownik nie ma aktywnego domu.",
  "User is already an active household member":
    "Użytkownik jest już aktywnym domownikiem.",
  "User is not registered locally":
    "Użytkownik nie jest zarejestrowany lokalnie.",
  "Validation failed": "Dane są nieprawidłowe.",
  "weekday and slotIndex must be provided together":
    "Dzień tygodnia i slot posiłku muszą być podane razem.",
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
      return "Nieprawidłowe zadanie.";
    case HttpStatus.UNAUTHORIZED:
      return "Brak autoryzacji.";
    case HttpStatus.FORBIDDEN:
      return "Brak uprawnień.";
    case HttpStatus.NOT_FOUND:
      return "Nie znaleziono zasobu.";
    case HttpStatus.CONFLICT:
      return "Konflikt danych.";
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return "Nie można przetworzyć danych.";
    case HttpStatus.TOO_MANY_REQUESTS:
      return "Zbyt wiele zadań. Spróbuj ponownie później.";
    default:
      return statusCode && statusCode >= 500
        ? "Wystąpił wewnętrzny błąd serwera."
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
