# Zachowanie przytomności

Źródło: fragment „Zachowanie przytomności” (reguła dodatkowa), przekazany
przez użytkownika 5 października 2026. Włączona zgodnie z jego prośbą.

- Rana ciężka, co najmniej lekka rana w głowę, czwarta i każda kolejna
  lekka rana otrzymana w jednej turze: Problematyczny test Budowy.
- Rana krytyczna: Cholernie trudny test Budowy, także przy trafieniu w głowę.
- Kilka przesłanek z jednej rany oznacza jeden test, z najtrudniejszym PT.
- Draśnięcia i siniaki nie są lekkimi ranami tej reguły.

Nowy Item rany (strzał, walka wręcz, ręczne dodanie, przeciągnięcie)
uruchamia sprawdzenie po zatwierdzeniu utworzenia. Edycja, opatrzenie
i usunięcie rany nie są nowym otrzymaniem obrażeń. Starych ran nie
zaliczamy wstecz. Usunięcie ani wyleczenie lekkiej rany nie zmniejsza
liczby ran otrzymanych w tej turze.

Interpretacja czasu: „Tura” to cała runda Trackera, złożona z 3 segmentów,
a nie moment działania pojedynczego uczestnika. Czas zapisujemy przy
tworzeniu rany; zamknięcie dialogu lub zmiana segmentu go nie zmienia.
Licznik jest oddzielny dla każdej walki i rundy. Poza aktywną walką
ciężka, krytyczna i rana głowy nadal wywołują test; kumulację lekkich
ran rozpatruje się ręcznie przyciskiem w sekcji „Rany i obrażenia”.

Test jest zamkniętym testem Budowy 3k20, bez Umiejętności Odporność na ból.
Wspólne okno testu pokazuje ustalony bazowy PT i pozwala ustalić z MG
kary za rany (w tym nową ranę), pancerz, efekty i dodatkowe modyfikacje.
Obowiązują standardowe dla systemu zasady naturalnych 1/20 i co najmniej
dwóch sukcesów. Wynik pojawia się na czacie. Porażka dodaje wbudowany
status `unconscious`; sukces nie usuwa wcześniejszej nieprzytomności.
Postać z tym statusem nie wykonuje kolejnych testów zachowania przytomności.
Utrata przytomności zamyka pozostałe testy w kolejce jako pominięte, bez
rzutów; kolejne rany podczas nieprzytomności również nie otwierają testów.
Przycisk testu jest wtedy ukryty. Po zdjęciu statusu nowe rany mogą znów
wywołać test, ale zamknięta kolejka nie jest ponawiana. Jeśli status został
nadany przy otwartym oknie testu, zatwierdzenie formularza nie rzuca kośćmi.

Na górze karty, niezależnie od zakładki, status pokazuje wyróżniony komunikat
„POSTAĆ NIEPRZYTOMNA — AKCJE ZABLOKOWANE”. Blokada obejmuje deklarowanie
akcji, pojedyncze strzały i serie, obsługę broni, zacięcia, Inicjatywę oraz
aktywne decyzje walki wręcz. Samo działanie z konta MG nie omija blokady:
aby pozwolić postaci działać, MG zdejmuje status Nieprzytomność.
Zadeklarowane, niewykonane akcje są przerywane; Tracker może iść dalej.
Skutki wcześniej oddanych pocisków muszą zostać rozliczone, lecz nie są
oddawane dalsze strzały. Nowe rany nieprzytomnego celu oraz testy Odporności
na ból działają normalnie. Po zakończeniu oczekujących obrażeń pojedynek
z nieprzytomnym uczestnikiem jest kończony.
Nie implementujemy dodatkowych zasad wybudzenia ani czasu nieprzytomności,
ponieważ nie ma ich w dostarczonym fragmencie.

Zamknięcie okna nie usuwa rany ani oczekującego testu. Karta pokazuje
powód i przycisk wznowienia. Wynik zapisuje się przed zmianą statusu,
aby awaria tej ostatniej nie pozwoliła ponownie rzucać. Dialog otwiera
się tylko u osoby zapisującej ranę; w innych klientach widać oczekujący
test na karcie. Kolejne zdarzenia i rzuty są kolejkowane lokalnie.
Foundry nie zapewnia tu transakcyjnej blokady równoczesnych zapisów
tej samej postaci z kilku klientów; nie należy rozpatrywać jej testu
jednocześnie u MG i gracza.
