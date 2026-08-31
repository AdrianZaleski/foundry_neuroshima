# Ustalenia projektowe

## Czytelność kodu

- Komentarze w kodzie piszemy w języku polskim.
- Komentarze wyjaśniają przede wszystkim odpowiedzialność fragmentu, działanie mechanizmu Foundry oraz powód ważnej decyzji projektowej.
- Własnym zmiennym i funkcjom nadajemy pełne, opisowe nazwy zamiast skrótów.
- Nazwy wymagane lub przyjęte przez API Foundry zachowujemy bez zmian, aby kod był zgodny z dokumentacją systemu.
- Nie komentujemy każdej oczywistej instrukcji, ponieważ nadmiar komentarzy utrudnia czytanie kodu tak samo jak ich brak.

## Arkusz danych Neuroshimy

- Udostępniony arkusz Google Sheets traktujemy jako źródło danych przygotowanych na podstawie podręczników Neuroshimy.
- Korzystamy z niego przy projektowaniu modeli danych oraz późniejszym przygotowaniu zawartości Compendium.
- Zakładkę `MISC` pomijamy, ponieważ zawiera luźne, nieuporządkowane materiały.
- Pozostałe zakładki można wykorzystywać jako dane zgodne z podręcznikami.
- Arkusz pozostaje materiałem referencyjnym tylko do odczytu; właściwa implementacja systemu jest zapisywana w repozytorium Git.

## Wiedza ogólna i własne umiejętności

- Postać będzie miała sześć pól wiedzy ogólnej, pokazanych na karcie w układzie 3+3.
- Każde pole wiedzy ogólnej będzie miało nazwę wpisywaną przez użytkownika oraz poziom.
- Wszystkie dziedziny wiedzy ogólnej będą testowane wyłącznie na Spryt.
- Oprócz wiedzy ogólnej postać otrzyma trzy pola na własne, dowolne umiejętności.
- Każda własna umiejętność będzie miała nazwę wpisywaną przez użytkownika, poziom oraz indywidualnie wybrany jeden z pięciu współczynników.
- Przykładowe własne umiejętności to Bumerang korzystający ze Zręczności, Lotnie korzystające ze Zręczności albo Malowanie korzystające z Percepcji.
- Nie wprowadzamy obecnie zależności umiejętność → inna umiejętność.
- Na etapie projektowania własnej umiejętności zakładamy strukturę obejmującą nazwę, wybrany współczynnik, wartość bazową, modyfikator i wartość końcową.

## Testy 3k20

### Podstawowa reguła z podręcznika

- Test wykonuje się rzutem trzema kośćmi dwudziestościennymi, czyli 3k20.
- Próg pojedynczej kości jest równy testowanemu współczynnikowi obniżonemu przez Poziom Trudności testu, w skrócie PT.
- Wynik kości równy progowi albo niższy od niego oznacza sukces na tej kości.
- Aby zdać cały test, sukcesem muszą zakończyć się co najmniej dwie z trzech kości.
- Wszystkie procentowe kary wynikające między innymi z warunków testu, ran i pancerza kumulują się.
- Na podstawie sumy kar procentowych ustalamy PT testu zgodnie z tabelą poziomów trudności.

### Poziomy trudności i kary procentowe

- Kary za rany, pancerz i inne utrudnienia będą sumowane, jeżeli są włączone dla danego testu.
- Łączna wartość procentowa będzie ustalała poziom trudności według poniższych przedziałów.

| Łączna wartość | Poziom trudności |
| ---: | --- |
| do -1% | Łatwy |
| 0–10% | Przeciętny |
| 11–30% | Problematyczny |
| 31–60% | Trudny |
| 61–90% | Bardzo trudny |
| 91–120% | Cholernie trudny |
| 121–160% | Fart |
| 161–200% | Mistrzowski |
| 201–240% | Arcymistrzowski |
| od 241% | Arcymistrzowski |

- Nazwa poziomu brzmi „Fart”. Nie używamy wariantu „Fartowny”.

### Wyniki 1 i 20

- Najpierw analizujemy wszystkie wyniki 1 i 20 oraz ustalamy ostateczny poziom trudności.
- Każda 1 ułatwia test o jeden poziom, a każda 20 utrudnia go o jeden poziom.
- Zasada działa również podczas walki, niezależnie od tego, czy dla danego testu działa Suwak.
- Uwzględniamy wyłącznie naturalne wyniki wyrzucone na kościach.
- Obniżenie wyniku kości do 1 za pomocą umiejętności nie uruchamia zasady szczęśliwej jedynki.
- Analogicznie późniejsze zmienienie wyniku kości do 20 nie uruchamia zasady pechowej dwudziestki.
- Dopiero na podstawie ostatecznego poziomu trudności obliczamy próg i oceniamy poszczególne kości.
- Do rozważenia pozostaje ustawienie świata dostępne dla MG: dwie lub trzy jedynki oznaczają automatyczny sukces, a dwie lub trzy dwudziestki automatyczną porażkę.
- Po włączeniu takiej opcji nadal pokazujemy i zapisujemy wyniki wszystkich kości. Szczegółowe zachowanie tej opcji wymaga jeszcze zatwierdzenia.

### Test zamknięty

- Każdą kość oceniamy osobno względem ostatecznego progu.
- Test jest zdany, jeżeli sukcesem zakończą się co najmniej dwie z trzech kości.
- Nadal liczymy i pokazujemy wynik każdej kości oraz pełną liczbę sukcesów od 0 do 3.

### Poziom umiejętności i suwak

- Zgodnie z podręcznikiem poziom umiejętności odejmujemy od wyników kości, a nie dodajemy do współczynnika.
- Wartość umiejętności można rozdzielić pomiędzy jedną albo kilka dowolnie wybranych kości użytych w teście.
- Suma oczek odjętych od wszystkich kości ma być równa pełnemu poziomowi umiejętności.
- Przykładowo umiejętność na poziomie +5 pozwala odjąć 5 od jednej kości albo rozdzielić tę wartość, na przykład odjąć 1 od jednej kości i 4 od drugiej.
- Punkty umiejętności wykorzystane w obliczeniu nie są zużywane ani trwale odejmowane od postaci.
- Referencyjna karta Roll20 automatycznie rozdziela poziom umiejętności. Podręcznik dopuszcza wybór dowolnych kości, dlatego sposób obsługi tego wyboru w Foundry wymaga osobnej decyzji projektowej.
- W zwykłym teście umiejętności działa również suwak: każde pełne 4 punkty umiejętności ułatwiają test o jeden poziom.
- Suwak i poprawianie kości działają jednocześnie.
- Umiejętność na poziomie 0 zawsze utrudnia test o jeden poziom.
- Powyższa kara za brak umiejętności obowiązuje zarówno w zwykłym teście, jak i w Teście Walki.

### Test Walki

- Suwak nie działa podczas walki w aktywnych testach takich jak strzelanie, rzucanie albo zadawanie ciosów.
- Suwak może działać podczas walki w testach umiejętności niezwiązanych bezpośrednio z wykonywaniem ataku, na przykład Morale albo Odporności na ból.
- Suwak działa także w testach wykonywanych przed rozpoczęciem właściwej walki, na przykład podczas strzału snajperskiego albo ataku na zaskoczonego przeciwnika.
- Jeżeli Suwak jest wyłączony z powodu aktywnego Testu Walki, nie stosujemy ułatwień wynikających z pełnych wielokrotności 4 punktów umiejętności.
- Poziom umiejętności nadal służy do poprawiania wyników kości.
- Umiejętność na poziomie 0 nadal utrudnia Test Walki o jeden poziom.

### Test otwarty

- Test otwarty służy do ustalenia nie tylko sukcesu albo porażki, lecz także stopnia powodzenia.
- W podstawowym wariancie MG nie podaje dokładnego PT. Test określa najwyższy poziom trudności, z którym poradziłaby sobie postać.
- Gracz rzuca 3k20, a najwyższy, czyli najgorszy wynik kości zostaje pominięty.
- Do rozstrzygnięcia pozostają dwie niższe, czyli lepsze kości. Obie muszą zakończyć się sukcesem.
- Poziom umiejętności rozdzielamy między te dwie kości według normalnych zasad.
- W teście otwartym wykorzystujemy cały dostępny poziom umiejętności, aby uzyskać najlepszy możliwy rezultat.
- Punkty umiejętności użyte podczas obliczenia nie są trwale odejmowane od postaci.
- Po poprawieniu kości porównujemy testowany współczynnik z gorszym, czyli wyższym wynikiem spośród dwóch rozpatrywanych kości.
- Dodatnia albo zerowa różnica oznacza sukces. Pozostały zapas oczek stanowi Punkty Sukcesu testu otwartego.
- Jeżeli obu kości nie udało się obniżyć do wymaganego progu, brakująca różnica stanowi Punkty Porażki.
- Wynik porażki przedstawiamy czytelnie jako „Porażka o X punktów”, zamiast pokazywać ujemną liczbę Punktów Sukcesu.
- MG może również wskazać konkretny PT testu otwartego. Wtedy osiągnięte Punkty Sukcesu zmniejszamy o ten PT.

### Test przeciwstawny

- Każdy z przeciwników wykonuje własny test otwarty.
- Następnie porównujemy uzyskane Punkty Sukcesu.
- Wygrywa postać z większą liczbą Punktów Sukcesu.
- Różnica pomiędzy wynikami stanowi Punkty Przewagi zwycięzcy i określa rozmiar zwycięstwa.
- Przed rzutem MG może przydzielić każdej stronie osobny dodatkowy PT wynikający z jej sytuacji.

## Masa przedmiotów

- Na karcie Itemu użytkownik może podać masę w gramach (`g`) albo kilogramach (`kg`).
- Domyślną jednostką amunicji są gramy, a broni i zwykłego ekwipunku kilogramy.
- System przelicza każdą masę na kilogramy przed wykonaniem dalszych obliczeń.
- Łączna masa stosu przedmiotów, zapasu amunicji, załadowanej broni i całego ekwipunku postaci jest wyświetlana w kilogramach.
- Wyniki masy zachowują dokładność do `0,001 kg`, czyli jednego grama.
- Jednostka wybrana przez użytkownika jest daną zapisywaną. Wartości przeliczone i sumy są polami wyliczanymi, których użytkownik nie edytuje ręcznie.

## Rany i procentowe utrudnienia

- Każda rana jest osobnym Itemem typu `injury` należącym do postaci.
- Rana przechowuje nazwę, lokację, rodzaj, karę procentową oraz opis skutków.
- Rodzaje ran odpowiadają zapisowi z karty referencyjnej: Draśnięcie, Lekka, Ciężka i Krytyczna.
- Wartości obrażeń `1`, `3`, `9` i `27` są wyliczane z rodzaju rany i nie są wpisywane osobno.
- Suma kar z ran jest wyliczana z aktualnej listy ran. Nie zapisujemy jej jako niezależnej wartości.
- Kara pancerza jest obecnie wpisywana ręcznie na Actorze. Docelowo będzie wyliczana z założonych Itemów pancerza.
- Przed rzutem użytkownik decyduje, czy test uwzględnia rany i pancerz.
- W tym samym oknie można podać dodatkowe utrudnienie sytuacyjne w procentach. Wartość ujemna oznacza ułatwienie.
- Procenty dodajemy do początkowej wartości wybranego PT, a otrzymany wynik ponownie przypisujemy do przedziału tabeli PT.
- Przykład: test Przeciętny zaczyna od `0%`. Łączna kara `74%` daje PT Bardzo trudny.
- Dopiero później stosujemy Suwak umiejętności oraz wpływ naturalnych wyników `1` i `20`.

## Struktura karty postaci

- Karta korzysta z natywnych zakładek ApplicationV2 dostępnych w Foundry 14.
- Zakładka `Główne` zawiera nazwę, współczynniki, rany oraz utrudnienia.
- Zakładka `Postać` zawiera dane osobowe, pochodzenie, profesję, specjalizację, Punkty Doświadczenia, sztuczki, cechy oraz notatki.
- Zakładka `Umiejętności` zawiera wszystkie standardowe i własne umiejętności.
- Zakładka `Ekwipunek` zawiera obciążenie, broń, amunicję oraz zwykłe przedmioty.
- Każda zakładka ma osobny plik Handlebars w `templates/actor/parts`.
- Podział dotyczy wyłącznie sposobu wyświetlania. Nie zmienia zapisanych danych Actora ani Itemów.

## Dane osobowe, sztuczki i cechy

- Ksywa postaci jest standardową nazwą dokumentu Actor w Foundry.
- Imię, nazwisko i Punkty Doświadczenia są zapisywane bezpośrednio w danych systemowych Actora.
- Actor przechowuje kod wybranego pochodzenia, profesji i specjalizacji, a ich nazwy oraz opisy pobiera z odpowiednich Compendiów.
- Obok wyborów katalogowych pozostają pola tekstowe, dzięki czemu można wpisać własny wariant pochodzenia, profesji albo specjalizacji.
- Compendia `Neuroshima: Pochodzenia`, `Neuroshima: Profesje` oraz `Neuroshima: Specjalizacje` są synchronizowane odpowiednio z zakładkami `ORIGIN`, `CLASS` i `SPECIALIZATION`.
- Stabilne kody wyborów przygotowują podstawę pod późniejsze automatyczne bonusy oraz dopasowywanie dostępnych cech i sztuczek.
- Opis postaci, reputacja oraz przyjaciele i kontakty są osobnymi polami notatek Actora.
- Sztuczki są osadzonymi Itemami typu `perk`, a cechy osadzonymi Itemami typu `trait`.
- Oba typy korzystają ze wspólnego modelu obejmującego kod źródłowy, zestaw zasad, wymagania, działanie i opis.
- Rozdzielenie typów umożliwia przygotowanie osobnych Compendiów na podstawie zakładek `PERK` i `TRAIT` arkusza referencyjnego.
- Compendium `Neuroshima: Sztuczki` jest synchronizowane z katalogiem utworzonym z zakładki `PERK`.
- Compendium `Neuroshima: Cechy` jest synchronizowane z katalogiem utworzonym z zakładki `TRAIT`.
- Arkusz zawiera dwa różne rekordy cechy `TRAIT_REPUTACJA`, przeznaczone dla Medyka i Najemnika. W katalogu ich kody rozszerzamy o wymaganie profesji, zachowując oryginalny kod w metadanych importu.
- Po dodaniu nowego podtypu dokumentu do `system.json` wymagany jest pełny restart serwera Foundry. Odświeżenie samej karty przeglądarki nie przeładowuje serwerowej listy dozwolonych typów.

## Katalog broni dystansowej i amunicji

- Źródłowe katalogi JSON zawierają dane z zakładek `RANGED` i `AMMO` arkusza referencyjnego.
- `sourceCode` identyfikuje dokładny wariant przedmiotu. Dla własnej broni i amunicji system generuje go automatycznie.
- `ammunitionSymbol` na amunicji określa rodzinę kompatybilności.
- `ammunitionCode` na broni wskazuje rodzinę amunicji przyjmowaną przez broń.
- Kilka wariantów amunicji może mieć różne kody źródłowe i ten sam symbol kompatybilności.
- Karty broni i amunicji pokazują listę znanych rodzin, ale pozwalają też wpisać nowy symbol.
- Na karcie postaci pokazujemy czytelną nazwę amunicji, zachowując techniczny symbol w danych.
- Aktualna zakładka `RANGED` nie zawiera kodów źródłowych. Istniejące kody zachowujemy w repozytorium, a rekordy arkusza dopasowujemy po unikalnej nazwie broni.
- Kolumnę `5E obrażenia` z zakładki `RANGED` świadomie pomijamy.
- Nowa broń otrzymuje stały kod źródłowy w repozytorium.

## Słowniki obrażeń i rodzajów ataku

- Zakładka `DAMAGE` definiuje osiem symboli obrażeń, ich nazwy, modyfikatory i opisy ran według lokacji.
- Zakładka `ATTACK` definiuje symbole rodzajów ataku i manewrów wraz z opisami.
- Na obecnym etapie dane te służą do wyświetlania zrozumiałych nazw na kartach.
- Samo zapisanie słowników nie uruchamia jeszcze mechaniki walki ani automatycznego zadawania ran.
