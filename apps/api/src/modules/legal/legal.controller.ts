import {
  HOMEAPP_ACCOUNT_DELETION_URL,
  HOMEAPP_LEGAL_CONTACT,
  HOMEAPP_LEGAL_DOCUMENTS,
  HOMEAPP_PRIVACY_URL,
  HOMEAPP_TERMS_URL,
  type LegalDocumentContent,
  type LegalDocumentKey,
} from "@homeapp/shared-types";
import { Controller, Get, Header } from "@nestjs/common";

@Controller("legal")
export class LegalController {
  @Get("privacy")
  @Header("Cache-Control", "public, max-age=3600")
  @Header("Content-Type", "text/html; charset=utf-8")
  privacy(): string {
    return renderLegalDocument("privacy");
  }

  @Get("terms")
  @Header("Cache-Control", "public, max-age=3600")
  @Header("Content-Type", "text/html; charset=utf-8")
  terms(): string {
    return renderLegalDocument("terms");
  }

  @Get("account-deletion")
  @Header("Cache-Control", "public, max-age=3600")
  @Header("Content-Type", "text/html; charset=utf-8")
  accountDeletion(): string {
    return renderPage(
      "Usunięcie konta HomeApp",
      [
        "<h1>Usunięcie konta HomeApp</h1>",
        "<p>Konto i powiązane z nim dane można usunąć bezpośrednio w aplikacji: <strong>Dom → Konto → Usuń konto</strong>. Operacja wymaga potwierdzenia i wyloguje użytkownika.</p>",
        `<p>Jeżeli nie masz dostępu do aplikacji, rozpocznij żądanie poza nią, wysyłając wiadomość z adresu przypisanego do konta na <a href="mailto:${HOMEAPP_LEGAL_CONTACT}?subject=Usuni%C4%99cie%20konta%20HomeApp">${HOMEAPP_LEGAL_CONTACT}</a> z tematem „Usunięcie konta HomeApp”. Nie przesyłaj hasła, frazy szyfrującej ani kodu odzyskiwania.</p>`,
        "<p>Po niezbędnej weryfikacji konto i dane powiązane z użytkownikiem zostaną usunięte albo zanonimizowane. Ograniczony zakres danych może pozostać przez okres wymagany do ochrony usługi, rozliczenia nadużyć lub wykonania obowiązku prawnego; kopie zapasowe są usuwane w zwykłym cyklu rotacji.</p>",
        `<p><a href="${HOMEAPP_PRIVACY_URL}">Polityka prywatności</a> · <a href="${HOMEAPP_TERMS_URL}">Regulamin</a></p>`,
      ].join("\n"),
      HOMEAPP_ACCOUNT_DELETION_URL,
    );
  }
}

function renderLegalDocument(key: LegalDocumentKey): string {
  const document = HOMEAPP_LEGAL_DOCUMENTS[key];
  const canonicalUrl =
    key === "privacy" ? HOMEAPP_PRIVACY_URL : HOMEAPP_TERMS_URL;
  const body = [
    `<h1>${escapeHtml(document.title)}</h1>`,
    `<p><strong>Obowiązuje od: ${escapeHtml(document.effectiveDate)}</strong></p>`,
    ...document.introduction.map(
      (paragraph) => `<p>${escapeHtml(paragraph)}</p>`,
    ),
    ...renderSections(document),
    `<p><a href="${HOMEAPP_PRIVACY_URL}">Polityka prywatności</a> · <a href="${HOMEAPP_TERMS_URL}">Regulamin</a> · <a href="${HOMEAPP_ACCOUNT_DELETION_URL}">Usunięcie konta</a></p>`,
  ].join("\n");

  return renderPage(document.title, body, canonicalUrl);
}

function renderSections(document: LegalDocumentContent): string[] {
  return document.sections.flatMap((section) => [
    `<h2>${escapeHtml(section.title)}</h2>`,
    ...section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
  ]);
}

function renderPage(title: string, body: string, canonicalUrl: string): string {
  return [
    "<!doctype html>",
    '<html lang="pl">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`,
    "</head>",
    "<body>",
    "<main>",
    body,
    "</main>",
    "</body>",
    "</html>",
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
