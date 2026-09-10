# Rozwój za PD — 2026-09-10

## Źródła kosztów

Tabela „Rozwój Bohatera” z przesłanego zdjęcia podręcznika ma pierwszeństwo.
Zakup Umiejętności: 200 PD. Kolejne poziomy 2–12 kosztują odpowiednio:
60, 90, 200, 250, 300, 350, 800, 900, 1000, 1100, 2400 PD.
Powyżej 12: nowy poziom × 200.

Współczynniki: poziomy 6–15 kosztują poziom × 100, poziomy 16–19 × 200.
Poziom 20 kosztuje 6000 według `karta_roll20_Neuroshima/Umiejetnosci.html`;
zdjęcie podaje formułę × 300 dla poziomów powyżej 20. Koszty do poziomu 5
nie są podane, więc zakupów tych nie udostępniamy.

Specjalizacja pochodzi z wiersza Roll20: pierwszy poziom nadal 200,
podniesienia kosztują 80% ceny zwykłej. Zwykły wiersz Roll20 ma błędnie
przesunięte liczby, więc nie stanowi źródła kosztów niespecjalizowanych.

## Działanie

- Zakładka Postać: zakup rozwoju z podglądem ceny i potwierdzeniem.
- Kupujemy jeden poziom bazy. Efekty i premie cech nie są nadpisywane.
  Jest to przyjęty model implementacji; zdjęcie nie określa osobno sposobu
  wyceny poziomów otrzymanych z cech.
- Saldo, baza i wpis historii są przesyłane jednym wywołaniem Actor.update.
- Brak PD, brak ceny i zmiana wyceny podczas potwierdzania blokują zakup.
- Dana Umiejętność lub Współczynnik może wzrosnąć raz po danej sesji.
  MG ręcznie otwiera kolejną sesję rozwoju dla konkretnego Actora.
- Historia zachowuje poprzedni i nowy poziom, cenę, saldo, użytkownika,
  czas i numer sesji. Nie kasujemy jej przy otwarciu kolejnej sesji.
- Nauka nowej Umiejętności i nauczyciel są uzgadniani z MG; okno o tym
  przypomina. Nie wyznaczamy automatycznie czasu nauki.
- Bezpośrednia ręczna edycja bazy i PD nadal działa jako korekta.
  Nie jest zakupem i nie zapisuje wpisu historii rozwoju.
- Zakup sztuczek i Reputacji jest poza tym zakresem. Ich koszty i limity
  ze zdjęcia wymagają przyszłej implementacji (sztuczka 200, PR 25,
  maksymalnie jedna sztuczka i łącznie 5 PR po sesji).
- Blokada równoległych okien działa w obrębie klienta. Jednoczesne zakupy
  tej samej postaci z dwóch klientów nie mają serwerowej blokady transakcji.

## Sprawdzenie w grze

Nadać testowej postaci 300 PD, kupić nową Umiejętność za 200, sprawdzić
poziom 1, saldo 100 i historię. Ponowny rozwój tej Umiejętności powinien
być niedostępny do otwarcia kolejnej sesji przez MG. Sprawdzić też anulowanie
zakupu, brak PD i koszt poziomu 2 w Specjalizacji (48 PD).
