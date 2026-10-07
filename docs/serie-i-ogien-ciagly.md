# Serie i ogień ciągły — 2026-10-06

Źródło: „Neuroshima — Podręcznik Podstawowy 1.5”, drukowane s. 189–191
(strony PDF 190–192), odczytane z lokalnego skanu podręcznika.

## Obsługa

Na karcie wybierz **Strzel** przy gotowej broni w dłoniach. Broń z trybem
`A` i dodatnią szybkostrzelnością udostępnia trzy dodatkowe opcje.
`X` to pole „Szybkostrzelność” broni.

| Tryb | Czas | Naboje w kolejnych segmentach | Łącznie |
|---|---|---|---|
| Krótka seria | 1 segment | X | X |
| Długa seria | 2 segmenty | X, 2X | 3X |
| Ogień ciągły | 3 segmenty | X, 2X, 3X | 6X |

Wybór pokazuje faktyczną liczbę dostępnych nabojów. Pusty magazynek kończy
akcję po wystrzeleniu reszty amunicji. Tryby są również w katalogu akcji.
Samo oznaczenie `B` nie udostępnia tych trybów.

Domyślną pozycją okna „Zadeklaruj akcję” jest zwykły Strzał. Serie są
wyszarzone, gdy żadna gotowa broń w dłoniach nie ma trybu A i dodatniej
szybkostrzelności. Brak obsługi serii nie oznacza braku gotowości do strzału
pojedynczego. Przykładowy katalogowy „AK (Kałasz)” ma obecnie zapisane `S`;
ta poprawka interfejsu nie zmienia danych katalogowych ani egzemplarzy.

Po deklaracji wybierz warunki strzału. Seria używa Zręczności i Broni
maszynowej oraz **jednego k20 na całą akcję**, rzucanego w pierwszym
segmencie. Punkty Umiejętności wydaje się raz ze wspólnej puli rundy.
Warunki i wynik zostają zapisane; kolejne segmenty kontynuują ten sam test.
Automatycznie uwzględniamy katalogowy kod `WEAPON_AUTO_PENALTY:N`.

Sukces daje maksymalnie PS+1 trafień, ograniczonych liczbą pocisków.
Każdy kolejny pocisk pogarsza wynik o 1 i zwiększa wynik lokacji o 1,
również po przejściu do następnego segmentu. Naturalna 20 nie trafia.
Zadeklarowana wcześniej konkretna lokacja zostaje zachowana dla trafień.
Wynik lokacji ponad tabelą 1–19 wymaga jawnego wskazania lokacji przez MG.

Pociski rozliczamy kolejno: osłona pancerza, Redukcja i PP, rana, test bólu,
utrata Wytrzymałości. Zniszczony pancerz nie chroni przed następnym pociskiem.
Każde trafienie tworzy osobną ranę i korzysta z istniejącej obsługi
zachowania przytomności. Zacięcie używa dotychczasowego mechanizmu systemu.

Tracker rozlicza kolejną porcję pocisków podczas następnej kolejki strzelca.
Akcja może przejść przez granicę rundy. Na karcie widać sumę wystrzelonych
nabojów i trafień; czat pokazuje wynik każdego segmentu. **Przerwij dalszy
ogień** zachowuje dotychczasowe skutki i kończy dalsze strzelanie.

Zamknięty test bólu zostawia oczekujące obrażenia. Przycisk **Rozlicz pociski
bieżącego segmentu** wznawia je bez ponownego pobrania amunicji ani tworzenia
zapisanych już ran. Po zapisaniu wyniku bólu nie rzucamy go ponownie.
Jeśli gracz nie ma uprawnień do celu, MG wznawia rozliczenie na karcie
strzelca. Tracker czeka na dokończenie skutków już oddanych pocisków.

## Zakres i dalsze prace

To obsługa serii w jeden cel. Korygowanie i przenoszenie ognia, osobny tryb
trzystrzałowy `B`, dodatkowe warianty celowania serią oraz opcjonalne
alternatywne liczby kości pozostają do osobnego wdrożenia. Nie rozszerzamy
skutków ran kończyn. Cel musi mieć kartę postaci.

Testy obejmują koszty wszystkich trybów, przejście między rundami, limity
amunicji, punkty Umiejętności, lokacje, osobne rany, zużywanie pancerza,
zacięcia, przerwanie, zamknięte okno bólu, uprawnienia oraz wznowienie po
błędzie końcowego zapisu. Podgląd okna sprawdzono przy szerokości 560 i 436 px.
Pełna weryfikacja sesji z oddzielnym klientem gracza i MG pozostaje testem
użytkowym w Foundry.
