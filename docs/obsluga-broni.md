# Obsługa broni — 2026-10-04

## Zrealizowany przebieg

- Dobycie broni: 2 segmenty, z wyborem lewej dłoni, prawej lub obu. Dłonie
  muszą być wolne. Samo dobycie zachowuje wcześniejszy stan przygotowania
  egzemplarza, nie przygotowuje ani nie odbezpiecza go automatycznie.
- Dodatkowe przygotowanie: 2 segmenty, wyłącznie przy jawnym wymogu MG
  na egzemplarzu (`requiresPreparation`). Domyślnie wymóg jest wyłączony,
  także dla starszych broni z `prepared: false`. Opis wymaganej czynności
  można wpisać w `preparationDescription`. To nie jest celowanie.
  Odbezpieczenie: 1 segment. Ręczne przeładowanie
  mechanizmu po strzale: 1 segment, tylko gdy egzemplarz tego wymaga.
  Koszty pochodzą z istniejącego katalogu akcji segmentowych.
- Przeładowanie / uzupełnienie magazynka: czas `reloadTime` konkretnej broni.
  Użytkownik potwierdził, że wartości katalogu oznaczają segmenty, np. 9
  oznacza trzy rundy. Wartość 0 wymaga podania czasu uzgodnionego z MG.
- Osobna akcja ładowania jednego naboju do bębna: 3 segmenty, tylko rewolwer.
- Przeładowanie przenosi wybraną liczbę zgodnych nabojów z zapasu do broni,
  zachowuje już załadowane naboje oraz nie miesza wariantów. Zachowuje też
  masę amunicji. Nie modeluje osobnych wymiennych magazynków jako Itemów.
- Przeładowanie kończy oczekiwanie na cykl mechanizmu;
  nie usuwa zacięcia ani zabezpieczenia. Jest to przyjęty zakres pełnej
  czynności przeładowania w interfejsie, bez osobnego śledzenia komory.
  Jawny dodatkowy wymóg MG pozostaje do wykonania po załadowaniu nabojów.
- Strzelać można wyłącznie z broni trzymanej w wymaganej liczbie dłoni,
  przygotowanej, odbezpieczonej, sprawnej i załadowanej. Stan sprawdzany jest
  także po zamknięciu okien konfiguracji i wydawania punktów Umiejętności.
- Po wystrzale ubywa jeden nabój. Przy zacięciu nabój nie ubywa. Opcjonalny
  wymóg ręcznego cyklu blokuje następny strzał do obsłużenia mechanizmu.

## Czas, anulowanie i zapis

- W aktywnej walce czynność rozpoczyna się tylko we własnej kolejce,
  w wolnym segmencie. Zmiana stanu następuje w ostatnim segmencie czynności.
  Akcje dłuższe niż trzy segmenty przechodzą do następnych rund.
- Przerwanie nie zmienia dłoni ani stanu amunicji; wykorzystane segmenty
  pozostają wykorzystane. Obsługi broni nie można zakończyć wcześniej.
- Anulowanie formularza przed deklaracją niczego nie zapisuje.
- Koniec czynności jest rozliczany podczas przejścia Trackera do jej
  ostatniego segmentu. Przy błędzie dostępny jest przycisk ponowienia.
  Nie można przejść dalej bez wykonania albo przerwania czynności.
- Zmiana dłoni, broni lub wybranego zapasu w trakcie akcji zatrzymuje zapis,
  zamiast nadpisywać nowsze dane. Należy przerwać i zadeklarować ją ponownie.
- Potwierdzenie wykonania jest zapisywane razem ze zmienianymi danymi.
  Ponowienie po błędzie flagi Trackera nie przenosi amunicji drugi raz.
  Dodatkowe blokady chronią przed równoległym kliknięciem w jednym kliencie.
  Nie jest to serwerowa blokada transakcji pomiędzy niezależnymi klientami.
- Poza aktywną walką zatwierdzenie wykonuje czynność od razu.

## Dłonie i ustawienia egzemplarza

- Podczas walki panel dłoni pozwala odłożyć trzymany przedmiot albo zmienić
  jego chwyt, z czasem jawnie podanym przez użytkownika po uzgodnieniu z MG.
  Nie dobywa nowej broni z pominięciem odpowiedniej akcji.
- Przeładowanie wymaga dłoni pomocniczej niezajętej innym przedmiotem;
  broń trzymana oburącz sama nie blokuje przeładowania.
- Wymagane dłonie (domyślnie 1) oraz konieczność ręcznego cyklu po strzale
  ustala się na karcie egzemplarza. Nie są zgadywane z nazwy lub klasy broni.
- Zwykła broń trzymana, załadowana, sprawna i odbezpieczona jest gotowa do
  strzału. Nie wymaga obowiązkowego kliknięcia „Przygotuj”.
- Na zakładce Główne i w ekwipunku jeden przycisk wskazuje następny
  potrzebny krok oraz jego koszt. Rozwijana lista pokazuje pozostałe kroki.
  Osobna informacja odróżnia stan broni od oczekiwania na kolejkę lub końca
  bieżącej akcji. Stan trzymanej broni widać także pod dłońmi w nagłówku.
- Przycisk „Strzel” zachowuje konkretny egzemplarz; pozwala wybrać cel oraz
  zwykły albo celowany strzał. Anulowanie tego okna nie zajmuje segmentu.
- Edycja Itemu pozostaje ręczną korektą. Nie nalicza czasu walki.
- Nie dodano automatyzacji holsterCode, sztuczek zmieniających te koszty,
  kar za jednoręczne użycie broni dwuręcznej ani osobnego stanu nabojów
  w komorze. Nie są częścią tego etapu.

## Weryfikacja

Testy obejmują sekwencję dobycia i przygotowania, przejście przez rundy,
9 segmentów przeładowania, przerwanie, anulowanie, zajęte dłonie, zmiany
danych, ochronę przed powtórzeniem, zgodność amunicji, zacięcia i strzały.
Pozostaje próba w aktywnej sesji na klientach MG i gracza.

Scenariusz ręczny: schowana broń, pusty magazynek, zapas 20 nabojów,
czas przeładowania 9. Dobyć za 2 segmenty, załadować 10 nabojów za 9;
przed końcem liczby pozostają 0 i 20, po końcu 10 i 10. Oddać strzał:
magazynek 9. Powtórzyć z przerwaniem przeładowania: stan amunicji bez zmian.
