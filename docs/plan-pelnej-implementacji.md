# Plan pełnej implementacji systemu Neuroshima

Stan bazowego audytu: 2026-09-06. Aktualizacja priorytetów: 2026-09-10.

## Aktualne priorytety — 2026-09-10

Dalsza automatyzacja pojedynczych cech została odłożona decyzją użytkownika.
Aktualny stan i lista pozostałych prac są w
[cechy-stan-i-pozostale-prace.md](cechy-stan-i-pozostale-prace.md).
Ten zapis uaktualnia starsze opisy braków dotyczących cech poniżej.

Zatwierdzony następny etap: rozwój postaci za PD — koszt zakupu,
Specjalizacja, odjęcie punktów i historia zmian. Przed wdrożeniem ustalić
jednoznaczne źródło tabel kosztów. Przygotowano niezależny mechanizm wyceny
i wspólnego zapisu poziomu, salda oraz historii, z testami na cenach
testowych. Nie podłączono go jeszcze do karty ani modelu danych; czeka na
potwierdzoną tabelę kosztów i zasady wyznaczania kupowanego poziomu.
Kolejne kandydatury: pierwsza pomoc i leczenie ran, następnie
podstawowy przebieg walki wręcz. Pełne strzelanie i przygotowanie wydania
pozostają w planie.

## Cel

Celem jest doprowadzenie systemu Foundry do stanu, w którym karta postaci,
przedmioty i Combat Tracker obsługują zasady Neuroshimy 1.5 bez konieczności
ręcznego przepisywania wyników między kartami. Referencyjna karta Roll20 służy
do porównania zakresu karty, a arkusz Google Sheets `Bronie prototyp` jest
źródłem danych katalogowych. Zasady podręcznika i zatwierdzone ustalenia
projektowe mają pierwszeństwo przed niepełnym albo sprzecznym wpisem w arkuszu.

Rozszerzenia pochodzące z dodatków, na przykład Szczęście z `Ołowiu` oraz
umiejętności z `Piratów`, nie powinny być automatycznie dodawane do bazowej
karty Neuroshimy 1.5. Należy przygotować je jako opcjonalną zawartość.

## Stan obecny

### Karta i testy

- Dostępnych jest pięć podstawowych Współczynników oraz komplet 54 stałych
  Umiejętności Neuroshimy 1.5.
- Postać posiada sześć własnych dziedzin Wiedzy ogólnej i trzy własne
  Umiejętności z wybieranym Współczynnikiem.
- Działają testy zamknięte i otwarte 3k20, Suwak, naturalne `1` i `20`, kary
  procentowe oraz wybór uwzględniania ran i pancerza.
- Wybrana Specjalizacja oznacza należące do niej Umiejętności na karcie.
- Pochodzenia, profesje, specjalizacje, sztuczki i cechy są dostępne w
  Compendiach i mogą należeć do Aktora.

### Zdrowie

- Rany są osobnymi Itemami z rodzajem, lokacją, karą i wartością obrażeń.
- Działa test Odporności na ból oraz utworzenie rany na podstawie wyniku.
- Choroby posiadają etapy, a leki liczbę dawek i powiązanie z chorobą.
- Użycie dawki zmniejsza jej liczbę, ale efekt leku pozostaje opisowy.

### Walka i wyposażenie

- Działa Inicjatywa, trzy segmenty rundy oraz deklarowanie akcji trwających
  od jednego do trzech segmentów.
- Działa strzał pojedynczy, celowanie, wybór celu, lokacja trafienia,
  obrażenia, PP, pancerz, zużycie amunicji i zacięcia.
- Działa usuwanie lekkich, poważnych i krytycznych zacięć w zakresie już
  zatwierdzonych zasad.
- Pancerze chronią osobne lokacje, mają Redukcję, Wytrzymałość, wyjątki dla
  rodzaju obrażeń i automatycznie naliczane kary.

### Dane katalogowe

Aktualne katalogi zawierają:

- 232 bronie dystansowe,
- 48 rodzajów amunicji,
- 17 kompletnych broni ręcznych,
- 7 przykładowych pancerzy,
- 329 sztuczek i 143 cechy,
- 13 pochodzeń, 30 profesji i 4 specjalizacje,
- 21 chorób i 39 leków.

Liczba rekordów zgadza się z aktualnym arkuszem dla dotychczas importowanych
zakładek. Arkusz został jednak zmodyfikowany 2026-09-02, już po raportach
importu z 2026-08-31, dlatego przed wydaniem należy ponownie porównać zawartość
rekordów, a nie tylko ich liczbę.

## Brakujące elementy

### 1. Wspólny mechanizm efektów i modyfikatorów

To jest fundament dla dalszej automatyzacji. System przechowuje wiele kodów
efektów jako tekst, lecz ich jeszcze nie wykonuje.

Zrealizowany fundament:

- Actor przechowuje listę efektów z nazwą źródła, zakresem, wartością,
  stanem włączenia i opcjonalnym terminem wygaśnięcia,
- efekt może zmieniać wartość Współczynnika, poziom Umiejętności albo
  procentową trudność wszystkich testów,
- karta pozwala dodawać, edytować, wyłączać i usuwać efekty,
- każdy Współczynnik posiada zapisany modyfikator ręczny,
- zwykłe testy, Inicjatywa, Odporność na ból i strzał uwzględniają aktywne
  efekty oraz pokazują ich źródła,
- efekty procentowe można pominąć w oknie konkretnego rzutu; premie do
  wartości wyłącza się na karcie postaci,
- wygasły efekt pozostaje w historii, ale przestaje działać mechanicznie.

Do dodania:

- automatyczne tworzenie modyfikatorów z ran, pancerza, chorób, leków,
  sztuczek, cech, amunicji i dodatków do broni,
- interpretacja kolejnych kodów z zakładki `EFFECT` dotyczących broni,
  amunicji, zacięć i stanów specjalnych,
- bezpieczne pozostawienie nieznanego kodu jako opisu zamiast zgadywania jego
  działania.

Arkusz zawiera 86 wpisów `EFFECT`, między innymi modyfikatory Współczynników,
Umiejętności, zasięgu, PP, celności, niezawodności, efekty czasowe, śmierć,
gaz łzawiący i ignorowanie części kar z ran.

Pełne 86 definicji jest już importowane do Kompendium `Neuroshima: Efekty`.
Automatyzacja obejmuje 59 jednoznacznych definicji: pięć Współczynników i 54
konkretne Umiejętności. Pozostałych 27 wpisów zachowuje opis źródłowy i status
opisowy do czasu wdrożenia wymaganej mechaniki.

### 2. Pełna mechanika strzelania

Do dodania:

- automatyczna kara za dystans według klasy broni z zakładki `WEAPON` —
  zrealizowane dla standardowego strzału pojedynczego,
- modyfikatory za ruch strzelca i celu, postawę, widoczność, rozmiar celu
  oraz osłonę,
- kontrola, czy broń rzeczywiście obsługuje wybrany rodzaj ataku,
- przypisanie właściwej Umiejętności do klasy broni,
- wymagana Budowa i konsekwencje niespełnienia wymagania,
- szybkostrzelność, czas przeładowania, dobywanie i przygotowanie broni,
- seria krótka, seria długa i ogień ciągły,
- korygowanie i przenoszenie ognia,
- seria trzystrzałowa,
- strzał śrutem,
- strzał wieloma spustami,
- strzał z biodra,
- strzał snajperski,
- przygotowany strzał,
- granaty, granatniki i pozostała broń miotana,
- eksplozje, obszar działania i rozrzut niecelnego rzutu.

Obecnie pole dodatkowego modyfikatora pozwala MG ręcznie uwzględnić część tych
warunków, ale nie zastępuje właściwej mechaniki.

### 3. Broń, amunicja i dodatki

#### Powiązania broń ↔ amunicja — zrealizowane

Dwukierunkowa nawigacja między wpisami w Compendiach została dodana:

- karta broni pokazuje rodzinę amunicji oraz listę wszystkich kompatybilnych
  wariantów amunicji,
- karta amunicji pokazuje listę wszystkich broni używających jej rodziny,
- nazwa na liście jest odnośnikiem otwierającym właściwy Item,
- kilka odmian amunicji może korzystać z tego samego symbolu kompatybilności,
- na karcie broni warto dodatkowo pokazać kompatybilną amunicję posiadaną
  przez Aktora i jej łączną liczbę,
- brak załadowanego Compendium ma dawać czytelną informację, a nie błąd.

Relację wyznaczamy na bieżąco przez porównanie:

`weapon.system.ammunitionCode === ammunition.system.ammunitionSymbol`

Nie zapisujemy list odnośników na stałe w katalogowych plikach JSON. Byłyby
one dublowaniem danych i mogłyby się zdezaktualizować. Listy należy budować z
indeksów Compendiów podczas przygotowania karty Itemu. Dzięki temu relacje
pozostaną prawidłowe także po synchronizacji katalogu albo przeniesieniu danych
z Compendiów świata do docelowych paczek systemowych.

#### Efekty amunicji

- zastosowanie `effectCode` załadowanego wariantu,
- modyfikacje obrażeń, PP, zasięgu, celności i niezawodności,
- czytelna informacja w wyniku strzału, który wariant amunicji został użyty,
- kontrola mieszania różnych wariantów w magazynku,
- późniejsze wsparcie jakości amunicji; zakładka `AMMOQUALITY` jest obecnie
  niekompletna i wymaga uporządkowania przed importem.

#### Dodatki do broni

- osobny typ Itemu lub osadzane dodatki przypisane do konkretnej broni,
- 20 wpisów z zakładki `ADDON`,
- kontrola zgodności dodatku z klasą broni i miejscem montażu,
- działanie celowników, tłumików, dwójnogów, trójnogów, chwytów, bagnetów
  i podwieszanych granatników,
- zasilanie dodatków wymagających baterii,
- działania przygotowawcze, na przykład rozstawienie dwójnogu.

### 4. Walka wręcz

Do dodania:

- wybór przeciwnika i używanej broni,
- przeciwstawienie ataku i obrony,
- wydawanie punktów Umiejętności na własne kości oraz psucie kości
  przeciwnika,
- przejmowanie Inicjatywy,
- koszt akcji zależny od liczby sukcesów,
- bonus ataku, obrony, Inicjatywy i walki z wieloma przeciwnikami,
- sprawdzanie wymaganej Budowy,
- normalizacja profili obrażeń broni ręcznej,
- określenie lokacji, PP, pancerz i rany po trafieniu,
- obrażenia tnące i właściwe wyjątki pancerzy,
- walka bez broni,
- manewry Zwiększone Tempo, Szarża, Furia i Pełna Obrona,
- działania specjalne pochodzące ze sztuczek i cech.

### 5. Pancerze i osłony

Fundament pancerzy działa. Do pełnej obsługi pozostają:

- tarcze oraz ich bonusy do obrony,
- szybkie tworzenie własnego pancerza według tabeli kosztów,
- pancerze wykonywane z nietypowych materiałów,
- obsługa wszystkich wyjątków wykraczających poza obrażenia balistyczne
  i tnące,
- wykorzystanie pancerza również przez walkę wręcz, eksplozje i śrut,
- wygodna naprawa albo wymiana zniszczonego elementu.

### 6. Rany, leczenie, choroby i śmierć

Do dodania:

- osobne podsumowanie obrażeń każdej lokacji,
- mechaniczne skutki ran głowy, tułowia i kończyn,
- ograniczenia ruchu i czynności wynikające z ran,
- zasada śmierci po ranie krytycznej bez pierwszej pomocy,
- pierwsza pomoc, Leczenie ran i naturalne zdrowienie,
- wyłączenie, zaleczenie albo usunięcie rany bez kasowania historii,
- wykonywanie kodów efektów kolejnych etapów chorób,
- działanie leków, ich czas trwania i skutki uboczne,
- leki ogólne, takie jak środki przeciwbólowe i morfina.

### 7. Pochodzenie, profesja, specjalizacja, cechy i sztuczki

Do dodania:

- automatyczne albo proponowane bonusy pochodzenia,
- filtrowanie i proponowanie cech oraz sztuczek dla wybranej profesji,
- sprawdzanie wymagań przed dodaniem zdolności,
- wykonywanie mechanicznych efektów zdolności,
- zachowanie możliwości dodania własnego wpisu lub świadomego zignorowania
  wymagania przez MG.

### 8. Rozwój postaci i Punkty Doświadczenia

Do dodania po przygotowaniu docelowego układu karty:

- tabela kosztów poziomów Umiejętności i Współczynników,
- niższy koszt Umiejętności należących do Specjalizacji,
- podgląd kosztu następnego poziomu,
- kupowanie poziomu po potwierdzeniu,
- odjęcie PD i zapis historii rozwoju,
- możliwość ręcznej korekty przez MG.

### 9. Dane z arkusza, które nie są jeszcze używane

- `EFFECT`: 86 definicji efektów,
- `ADDON`: 20 dodatków do broni,
- `WEAPON`: 12 klas broni i tabele dystansu,
- `SKILL`: 64 Umiejętności Neuroshimy 1.5 oraz 4 z dodatków,
- `ATTRIBUTE`: pięć Współczynników podstawowych i opcjonalne Szczęście,
- `MISC_CAT`: 7 kategorii zwykłego wyposażenia,
- `AMMOQUALITY`: rozpoczęta, ale niekompletna tabela jakości amunicji,
- `DIFFICULTY`: tabela częściowo sprzeczna z przyjętą pełną tabelą PT.

Zakładka `MISC` pozostaje świadomie pominięta jako luźny i nieuporządkowany
zbiór. Jeśli w przyszłości ma zasilać Compendium wyposażenia, najpierw trzeba
wydzielić z niej jednoznaczne rekordy i powiązać je z `MISC_CAT`.

### 10. Interfejs i jakość wydania

- docelowy układ oraz styl karty,
- sylwetka postaci z ranami i pancerzem według lokacji,
- czytelniejsze, krótsze wiadomości rzutów,
- podpowiedzi zasad i źródeł modyfikatorów,
- szybkie przeciąganie i otwieranie powiązanych Itemów,
- migracje danych dla istniejących światów,
- testy jednostkowe obliczeń oraz testy integracyjne głównych przebiegów,
- docelowe systemowe Compendia zamiast prototypowej synchronizacji
  Compendiów świata.

## Kolejność realizacji

### Etap A — fundament efektów

1. Uporządkować model trwałych i czasowych modyfikatorów — zrealizowane.
2. Dodać ręczne modyfikatory Współczynników — zrealizowane.
3. Zaimportować `EFFECT` i zinterpretować premie oraz kary Współczynników i
   Umiejętności — zrealizowane; pozostałe grupy będą podłączane etapami.
4. Pokazywać źródła modyfikatorów w oknach testów — zrealizowane.

### Etap B — broń i pełne strzelanie

1. Dwukierunkowe odnośniki broń ↔ amunicja — zrealizowane.
2. Podłączyć klasy broni i automatyczne kary dystansu.
3. Podłączyć efekty specjalnej amunicji.
4. Dodać dodatki do broni.
5. Zaimplementować serie, śrut i wiele spustów.
6. Dodać strzały specjalne, granaty i eksplozje.

### Etap C — walka wręcz

1. Zbudować przeciwstawny przebieg atak–obrona.
2. Podłączyć parametry broni i obrażenia.
3. Dodać przejmowanie Inicjatywy, wielu przeciwników i manewry.

### Etap D — zdrowie

1. Dodać mechaniczne skutki ran i pierwszą pomoc.
2. Dodać leczenie oraz czasowe działanie leków.
3. Podłączyć efekty chorób i śmierć.

### Etap E — rozwój i karta docelowa

1. Dodać tabelę i wydawanie PD.
2. Podłączyć wymagania oraz bonusy historii postaci i zdolności.
3. Wykonać docelowy wygląd karty i wiadomości czatu.
4. Przygotować migracje, testy i systemowe paczki Compendiów.

## Najbliższy krok

Wybrać kolejny większy etap zgodnie z aktualnymi priorytetami powyżej.
Zapisany wcześniej krok strzelania — osobne ustawienia ruchu, widoczności,
osłony i wybranej lokacji — pozostaje otwarty, ale nie jest jedynym
kandydatem do następnej realizacji.
