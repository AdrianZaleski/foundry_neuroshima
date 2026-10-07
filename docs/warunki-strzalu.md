# Warunki strzału

Źródło: lokalny „Neuroshima — Podręcznik Podstawowy 1.5.pdf”, strony
drukowane 183–186 (strony PDF 184–187). Zweryfikowano wizualnie skany,
w szczególności tabelę na s. 185. Implementacja: 5 października 2026.

## Reguły

- Ruch strzelca: bieg +30%. Sprint/bieg asekuracyjny pozwala tylko na
  strzelanie na ślepo, więc blokuje obecny zwykły strzał.
- Ruch celu: bieg +20%, sprint/bieg asekuracyjny +40%.
- Minimalne wychylenie strzelca (głowa, ręka i broń): +20% do jego testu.
- Widoczne 2/3, 1/2, 1/3 sylwetki celu: odpowiednio +20%, +40%, +60%.
  Prawie sama głowa, ręka i broń: +80%.
- Cel klęczący odpowiada +40%, leżący +60%. W tabeli są to alternatywy
  dla części widocznej sylwetki. Przy dwóch wyborach w formularzu
  przyjmujemy większą z kar postawy/osłony, nie ich sumę.
- Wybrana lokacja: tułów +20%, noga +40%, ręka +60%, głowa +80%.
  Rozróżniamy lewą i prawą kończynę dla pancerza i zapisanej rany.
- Widoczność: osobna nieujemna kara ustalana przez MG. Nie przypisujemy
  wymyślonych wartości mgle, ciemności lub dymowi.
- Pozostałe modyfikatory: pole ze znakiem, np. dla nietypowego rozmiaru
  celu lub innych ustaleń MG. Nie wpisujemy ponownie już wybranych kar.

Całkowicie zasłonięty cel blokuje ten formularz. Strzelanie na ślepo
i przez przestrzeliwaną osłonę wymaga osobnych zasad. Osłona sytuacyjna
utrudnia trafienie; nie dodaje automatycznie Redukcji do pancerza celu.
Tabela nie definiuje osobnej premii do celności za klęczenie/leżenie
strzelca, więc nie dodajemy jej automatycznie.

## Przebieg

Przy rozstrzyganiu pojedynczego lub celowanego strzału formularz ma
osobne wybory warunków. Dystans nadal mierzymy na scenie; pozostałe
warunki wskazuje użytkownik z MG. Przesunięcie tokena, ściana lub zmiana
postawy w tym formularzu nie deklaruje ruchu ani nie wydaje segmentów.

Podgląd i zatwierdzony strzał korzystają z tej samej funkcji sumowania:
zasięg + rany + pancerz strzelca + efekty + warunki + pozostałe
modyfikatory + celność broni. Podgląd pokazuje PT przed kośćmi,
wraz ze zwiększeniem za brak Umiejętności. Naturalne 1/20 oraz wydawanie
punktów Umiejętności działają jak dotychczas. Podsumowanie i przycisk
rzutu pozostają widoczne przy przewijaniu formularza.

Wynik na czacie pokazuje wybrane warunki i wszystkie składniki sumy.
Zamknięcie formularza lub niepoprawne warunki nie rzucają kością,
nie zużywają naboju i pozostawiają zadeklarowany strzał nierozstrzygnięty.

Lokację wybiera się przed rzutem. Po trafieniu trafia ona do wyboru
pancerza, obliczeń obrażeń i tworzonej rany. Głowa podnosi obrażenia
o jeden poziom. Naturalne 1–2 nie zmieniają zadeklarowanego strzału
w nogę w trafienie głowy. Przy lokacji z kości zachowano dotychczasowy
wybór jednej z udanych kości po celowaniu. Przy stałej lokacji ten
dodatkowy dialog jest zbędny.

## Zakres dalszych prac

Następne etapy: serie i ogień ciągły, ogień na ślepo, przestrzeliwanie
osłon, śrut i specjalne tryby strzału. Skutki ran ograniczające działanie
kończyn pozostają poza bieżącym zakresem zgodnie z decyzją użytkownika.

## Weryfikacja

Testy obejmują tabelę wartości, niepowielanie kar, walidację, anulowanie,
zużycie naboju, wynik na czacie oraz obrażenia i pancerz wybranej lokacji.
Podgląd przeglądarkowy korzysta z faktycznego HTML formularza i CSS Foundry:
zmiana sumy/PT, blokady, wąskie okno oraz dostępny przycisk przy małej
wysokości. Pełna sesja kilku klientów Foundry nie była częścią tej kontroli.
