export const HOMEAPP_LEGAL_CONTACT = "porabkihome.app@gmail.com";
export const HOMEAPP_LEGAL_EFFECTIVE_DATE = "26 lipca 2026 r.";
export const HOMEAPP_PRIVACY_URL =
  "https://app.porabkihome.pl/api/legal/privacy";
export const HOMEAPP_TERMS_URL = "https://app.porabkihome.pl/api/legal/terms";
export const HOMEAPP_ACCOUNT_DELETION_URL =
  "https://app.porabkihome.pl/api/legal/account-deletion";

export type LegalDocumentKey = "privacy" | "terms";

export interface LegalDocumentSection {
  paragraphs: readonly string[];
  title: string;
}

export interface LegalDocumentContent {
  effectiveDate: string;
  introduction: readonly string[];
  sections: readonly LegalDocumentSection[];
  title: string;
}

export const HOMEAPP_LEGAL_DOCUMENTS: Record<
  LegalDocumentKey,
  LegalDocumentContent
> = {
  privacy: {
    effectiveDate: HOMEAPP_LEGAL_EFFECTIVE_DATE,
    introduction: [
      `Niniejsza Polityka prywatności opisuje przetwarzanie danych w aplikacji HomeApp. Administratorem danych jest wydawca i operator usługi HomeApp. W sprawach prywatności można skontaktować się pod adresem ${HOMEAPP_LEGAL_CONTACT}.`,
      "HomeApp służy do współdzielenia informacji w gospodarstwie domowym. Zakres danych zależy od funkcji, które użytkownik sam wybierze i od uprawnień nadanych mu w danym domu.",
    ],
    sections: [
      {
        title: "1. Jakie dane przetwarzamy",
        paragraphs: [
          "Przetwarzamy dane konta, takie jak adres e-mail, nazwa wyświetlana, zaszyfrowane dane uwierzytelniające, status konta oraz informacje potrzebne do logowania i odzyskania dostępu.",
          "Przetwarzamy treści wprowadzone do wybranego gospodarstwa domowego, między innymi budżety i wydatki, wydarzenia, zadania, notatki, listy zakupów, plany posiłków, informacje o sprzątaniu, kosztach rocznych, wpisach i załącznikach.",
          "Przetwarzamy dane techniczne niezbędne do bezpiecznego działania usługi, takie jak identyfikatory sesji, urządzenia i powiadomień push, znaczniki czasu, role, uprawnienia, zdarzenia bezpieczeństwa oraz podstawowe logi błędów. HomeApp nie wykorzystuje tych danych do reklamy.",
        ],
      },
      {
        title: "2. Cele i podstawy przetwarzania",
        paragraphs: [
          "Dane konta i treści domu przetwarzamy w celu wykonania umowy o świadczenie usługi HomeApp: założenia konta, synchronizacji danych, realizacji uprawnień, zaproszeń, kopii roboczych i funkcji współdzielenia.",
          "Dane techniczne i bezpieczeństwa przetwarzamy w prawnie uzasadnionym interesie polegającym na ochronie kont, zapobieganiu nadużyciom, diagnozowaniu awarii i zapewnianiu ciągłości usługi. Dane wymagane przepisami przetwarzamy w celu wykonania obowiązku prawnego.",
          "Dostęp do powiadomień Androida, powiadomienia push oraz połączenia z usługami zewnętrznymi są opcjonalne i uruchamiane decyzją użytkownika. Zgodę systemową można cofnąć w ustawieniach urządzenia, a połączenie z usługą zewnętrzną można odłączyć w HomeApp.",
        ],
      },
      {
        title: "3. Import wydatków z powiadomień Androida",
        paragraphs: [
          "Funkcja jest domyślnie wyłączona. Po osobnym włączeniu dostępu systemowego i wskazaniu źródła HomeApp lokalnie analizuje nowe powiadomienia wybranej aplikacji, aby rozpoznać możliwą płatność. Nie loguje się do banku, nie pobiera historii rachunku i nie używa zewnętrznej usługi ani AI do analizy treści.",
          "Surowa treść powiadomienia nie jest wysyłana na serwer. Zaszyfrowany szkic pozostaje na urządzeniu, a do domu trafiają dopiero finalne dane wydatku jawnie zatwierdzone przez użytkownika. Użytkownik może wyłączyć funkcję, cofnąć dostęp systemowy i usunąć lokalną kolejkę.",
        ],
      },
      {
        title: "4. Szyfrowanie i bezpieczeństwo",
        paragraphs: [
          "Połączenie z usługą jest szyfrowane w transmisji. Hasła są przechowywane w postaci bezpiecznych skrótów. HomeApp stosuje kontrolę dostępu według domu, roli i uprawnień.",
          "Dla obsługiwanych modułów właściciel domu może włączyć szyfrowanie end-to-end. W takim trybie treść jest szyfrowana na urządzeniu przed wysłaniem, a klucz lub fraza odzyskiwania nie są znane operatorowi. Utrata wszystkich kluczy i kodu odzyskiwania może uniemożliwić odzyskanie danych.",
        ],
      },
      {
        title: "5. Odbiorcy i usługi zewnętrzne",
        paragraphs: [
          "Treści domu są dostępne jego aktywnym członkom zgodnie z rolami i uprawnieniami ustawionymi przez właściciela. Dane mogą być powierzane dostawcom infrastruktury serwerowej, przechowywania plików, poczty transakcyjnej i powiadomień push wyłącznie w zakresie potrzebnym do świadczenia usługi.",
          "Jeżeli użytkownik wybierze logowanie Google lub synchronizację Kalendarza Google, odpowiednie dane uwierzytelniające i wybrane dane kalendarza są wymieniane z Google w zakresie tej funkcji. HomeApp nie sprzedaje danych i nie udostępnia ich podmiotom trzecim na potrzeby reklamy.",
        ],
      },
      {
        title: "6. Przechowywanie i usuwanie",
        paragraphs: [
          "Dane konta i domu przechowujemy przez okres korzystania z usługi. Po usunięciu konta dane powiązane z użytkownikiem są usuwane albo anonimizowane, z wyjątkiem ograniczonego zakresu potrzebnego do rozliczenia bezpieczeństwa, przeciwdziałania nadużyciom lub wykonania obowiązku prawnego. Kopie zapasowe są usuwane w zwykłym cyklu rotacji.",
          "Lokalna kolejka importu powiadomień ma automatyczną retencję: opcjonalny tekst diagnostyczny do 7 dni, oczekujące szkice do 30 dni, a znaczniki pozycji zaimportowanych lub odrzuconych do 180 dni. Kolejkę można również usunąć ręcznie.",
        ],
      },
      {
        title: "7. Prawa użytkownika",
        paragraphs: [
          `Użytkownik może żądać dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przeniesienia oraz wnieść sprzeciw, gdy podstawą jest prawnie uzasadniony interes. Żądanie można wysłać na ${HOMEAPP_LEGAL_CONTACT}. Cofnięcie zgody nie wpływa na zgodność wcześniejszego przetwarzania.`,
          "Konto można usunąć bezpośrednio w aplikacji: Dom → Konto → Usuń konto. Żądanie można także rozpocząć poza aplikacją, korzystając z publicznej strony usunięcia konta. Użytkownik ma prawo złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych.",
        ],
      },
      {
        title: "8. Dane innych osób i osoby małoletnie",
        paragraphs: [
          "Osoba dodająca do domu dane innej osoby powinna mieć podstawę do ich wprowadzenia i przekazać jej odpowiednią informację. HomeApp nie jest usługą kierowaną do dzieci i nie należy samodzielnie tworzyć konta osobie, która nie może skutecznie zaakceptować Regulaminu.",
        ],
      },
      {
        title: "9. Zmiany Polityki",
        paragraphs: [
          "Polityka może zostać zaktualizowana po zmianie funkcji, sposobu przetwarzania lub przepisów. Istotne zmiany będą komunikowane w aplikacji albo na adres e-mail konta, a aktualna wersja będzie dostępna pod stałym publicznym adresem.",
        ],
      },
    ],
    title: "Polityka prywatności HomeApp",
  },
  terms: {
    effectiveDate: HOMEAPP_LEGAL_EFFECTIVE_DATE,
    introduction: [
      `Regulamin określa zasady korzystania z aplikacji i usługi HomeApp. Operatorem usługi jest wydawca aplikacji HomeApp. Kontakt: ${HOMEAPP_LEGAL_CONTACT}.`,
      "Założenie konta albo przyjęcie zaproszenia wymaga zapoznania się z Regulaminem i Polityką prywatności oraz ich akceptacji.",
    ],
    sections: [
      {
        title: "1. Zakres usługi",
        paragraphs: [
          "HomeApp umożliwia organizację gospodarstwa domowego, w tym prowadzenie finansów, kalendarza, zadań, notatek, list zakupów, planów posiłków, załączników i innych wspólnych danych. Poszczególne funkcje mogą zależeć od systemu urządzenia, konfiguracji domu i nadanych uprawnień.",
        ],
      },
      {
        title: "2. Konto i bezpieczeństwo",
        paragraphs: [
          "Użytkownik podaje prawdziwy adres e-mail, chroni hasło i urządzenie oraz nie udostępnia sesji osobom nieuprawnionym. O podejrzeniu przejęcia konta należy niezwłocznie poinformować operatora.",
          "Jedna osoba nie powinna podszywać się pod inną ani obchodzić zabezpieczeń i ograniczeń uprawnień. Użytkownik odpowiada za działania wykonane z jego konta, jeżeli wynikają z naruszenia tych obowiązków.",
        ],
      },
      {
        title: "3. Dom, role i treści",
        paragraphs: [
          "Właściciel domu zarządza członkami, zaproszeniami, rolami i uprawnieniami. Użytkownik może wprowadzać wyłącznie treści, do których ma prawa, i powinien szanować prywatność pozostałych członków.",
          "Zabronione jest umieszczanie treści bezprawnych, szkodliwych, naruszających prawa osób trzecich, złośliwego kodu albo danych pozyskanych bez wymaganej podstawy.",
        ],
      },
      {
        title: "4. Finanse i import powiadomień",
        paragraphs: [
          "Moduł finansów ma charakter organizacyjny i informacyjny. HomeApp nie jest bankiem, biurem rachunkowym ani doradcą finansowym, nie potwierdza rozliczenia operacji i nie zastępuje historii bankowej.",
          "Import z powiadomień Androida przygotowuje lokalny szkic na podstawie tekstu wybranego źródła. Użytkownik ma obowiązek sprawdzić nazwę, kwotę, walutę, datę i pozycję budżetu przed zatwierdzeniem. Parser może nie rozpoznać lub błędnie zinterpretować zmieniony format powiadomienia.",
        ],
      },
      {
        title: "5. Szyfrowanie end-to-end",
        paragraphs: [
          "Po włączeniu szyfrowania end-to-end użytkownicy domu odpowiadają za bezpieczne zachowanie frazy, klucza i kodu odzyskiwania. Operator nie może odtworzyć utraconego sekretu i może nie mieć technicznej możliwości odzyskania zaszyfrowanej treści.",
        ],
      },
      {
        title: "6. Dostępność i zmiany",
        paragraphs: [
          "Operator dąży do bezpiecznego i ciągłego działania usługi, ale może wykonywać prace techniczne, usuwać awarie i wprowadzać zmiany konieczne dla bezpieczeństwa, zgodności lub rozwoju funkcji. O planowanych istotnych ograniczeniach użytkownicy zostaną poinformowani, gdy będzie to możliwe.",
        ],
      },
      {
        title: "7. Odpowiedzialność",
        paragraphs: [
          "Użytkownik odpowiada za poprawność wprowadzonych danych, własne decyzje podjęte na ich podstawie oraz posiadanie kopii informacji, których utrata mogłaby spowodować istotną szkodę. Postanowienia Regulaminu nie ograniczają praw konsumenta ani odpowiedzialności, której nie można wyłączyć na mocy prawa.",
        ],
      },
      {
        title: "8. Zawieszenie i zakończenie",
        paragraphs: [
          "Użytkownik może zakończyć korzystanie z usługi i usunąć konto w ustawieniach aplikacji. Operator może czasowo ograniczyć konto, gdy jest to konieczne dla bezpieczeństwa, usunięcia nadużycia lub wykonania prawa, a w razie poważnego albo powtarzającego się naruszenia Regulaminu może zakończyć świadczenie usługi.",
        ],
      },
      {
        title: "9. Reklamacje i kontakt",
        paragraphs: [
          `Problemy techniczne, reklamacje i pytania można wysłać na ${HOMEAPP_LEGAL_CONTACT}. Zgłoszenie powinno opisywać problem i, jeśli to możliwe, zawierać dane pozwalające zidentyfikować konto bez przesyłania hasła, frazy szyfrującej ani kodu odzyskiwania.`,
        ],
      },
      {
        title: "10. Prawo właściwe i zmiany Regulaminu",
        paragraphs: [
          "Do Regulaminu stosuje się prawo polskie, z zachowaniem bezwzględnie obowiązujących praw konsumenta. Istotne zmiany Regulaminu będą komunikowane przed ich wejściem w życie; jeżeli prawo tego wymaga, użytkownik zostanie poproszony o ponowną akceptację.",
        ],
      },
    ],
    title: "Regulamin HomeApp",
  },
};
