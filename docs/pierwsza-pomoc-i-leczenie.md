# Pierwsza pomoc i leczenie ran — stan 2026-09-11

Źródło: strony 204–206 podręcznika przekazane przez użytkownika w rozmowie.

## Wdrożony zakres

- Na karcie pacjenta przy ranie oraz w Zdrowie → Opatrywanie ran znajduje
  się przycisk `Opatrz ranę`. Wybór medyka obejmuje postacie, do których
  bieżący użytkownik ma uprawnienia właściciela; pacjent też musi być dostępny
  do edycji. MG może przeprowadzić zabieg między postaciami różnych graczy.
- Draśnięcie i rana lekka: PT Przeciętny. Ciężka i krytyczna: Problematyczny.
- Pierwsza pomoc: do 5 punktów procentowych redukcji kary; leczenie ran
  i pierwsza pomoc łącznie: do 15. Udane leczenie po pełnej pierwszej pomocy
  usuwa pozostałe 10. Porażka dodaje 5 punktów kary.
- Kolejne próby po porażce zwiększają PT o jeden poziom dla danej metody
  na danej ranie, niezależnie od zmiany medyka. Liczniki są oddzielne.
- Czas: pierwsza pomoc 1 tura, leczenie około 15 minut. Podwójny czas daje
  −20%. Ostrzał +40%, pomoc sprzętu od −10% do −30% według decyzji MG.
- Właściwy test 3k20 uwzględnia Umiejętność, Współczynnik, rany, pancerz
  i efekty medyka. PT zabiegu jest ustalony automatycznie; dodatkowy
  modyfikator można dopisać w zwykłym oknie testu.
- Kara rany i historia są zapisywane jednym wywołaniem aktualizacji Itemu.
  Historia obejmuje metodę, medyka, wynik, zmianę kary, PT, warunki i czas.
  Czat zawiera rzut oraz podsumowanie zmiany rany.
- Anulowanie obu okien niczego nie zmienia. Jeżeli rana zmieniła się podczas
  rzutu, wynik pozostaje na czacie, ale nie nadpisujemy jej danych.
- Starsze rany otrzymują pustą historię i zerowe liczniki. Zabiegi wykonane
  przed wdrożeniem nie są odtwarzane automatycznie.

## Granice etapu i dalsza praca

- Nie przesuwamy zegara ani segmentów automatycznie. Czas rozlicza stół.
- Udany zabieg oznacza opatrzenie danej rany krytycznej; nie jest orzeczeniem
  przeżycia postaci. Kumulacja obrażeń, inne rany krytyczne i śmierć nadal
  wymagają rozstrzygnięcia przez MG.
- Nie kasujemy rany przy karze 0%; opis i wartość obrażeń pozostają zachowane.
- Nie ma jeszcze gojenia dzień po dniu, leczenia chorób, radiacji i działania
  chemicznych środków leczniczych. To kolejne zakresy.
- Zdolności zmieniające zasady leczenia (np. Gwarancja bezpieczeństwa) nie
  zostały tu podłączone; wymagają odrębnej obsługi zgodnie z odłożonym planem cech.
- Blokada równoległego zabiegu działa na jednym kliencie; nie jest blokadą
  transakcji pomiędzy niezależnymi klientami Foundry.

## Weryfikacja

Osiem testów automatycznych obejmuje pełny przebieg testu i zapisu, limity
redukcji, porażki, stabilizację pojedynczej rany, anulowanie i zmianę rany
w trakcie rzutu. Test manualny w Foundry pozostaje do potwierdzenia.

Próba: rana z karą 30%, udana pierwsza pomoc → 25%, następnie udane leczenie
→ 15%. Dalsze opatrzenie tej rany nie może przekroczyć wykorzystanego limitu.
Na osobnej ranie porażka powinna dodać 5 punktów kary oraz utrudnić następną
próbę tej metody o poziom. Historia jest w zakładce Zdrowie.
