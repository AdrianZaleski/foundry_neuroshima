# Cechy i sztuczki — stan oraz odłożony zakres

Stan: 2026-09-10. Dalsza automatyzacja pojedynczych cech odłożona decyzją
użytkownika: obecnie ma zbyt mały przyrost korzyści względem nakładu pracy.
Nie usuwać już wdrożonych mechanizmów.

## Co działa

- Premie pochodzeń; wybór Współczynnika dla nieznanego pochodzenia.
- Panel dodania zdolności: opis, działanie, wymagania, brakujące progi,
  możliwość dodania mimo wymagań i anulowania.
- Blokada ponownego dodania tej samej cechy/sztuczki; wspólne rozpoznawanie
  potwierdzonych odpowiedników PERK/TRAIT, bez podwójnego naliczania premii.
- Hazardzista: +2 do Zdolności manualnych, także wersja PERK.
- Doktor Quinn: Medycyna minimum 4, wymóg kobiety i jawny wyjątek MG.
- Swoje przeszedłem: Walka wręcz i Siła woli minimum 1.
- Wyszkolenie: Broń strzelecka i Pirotechnika minimum 1.
- Urodzony morderca: wybór pakietu Wojownika, +2.
- Szlachetnie urodzony: wybór pakietu opartego o Charakter, +2.
- Koleś zwany koniem: Jeździectwo minimum 2; pozostałe działanie niegotowe.
- Umysł kupca: ręczny przełącznik +2 Spryt/Charakter, −1 pozostałe
  Współczynniki. Trwa do przespania nocy, co ustalają uczestnicy gry;
  bez automatycznego zegara odpoczynku.
- Płeć postaci i kontrola jawnych wymagań płci; brak wyboru nie daje
  automatycznie uprawnień do efektu wymagającego konkretnej płci.
- Diagnostyka cech i wartości Umiejętności dostępna również poza walką.

W katalogu TRAIT są 143 rekordy: 7 z podłączonym działaniem w przyjętym
zakresie, 1 częściowo podłączony (Koleś zwany koniem), 135 bez indywidualnej
automatyzacji. To liczba rekordów, nie liczba brakujących mechanizmów.
Nie jest to statystyka odrębnego katalogu PERK.

Użytkownik potwierdził manualnie premie, blokadę duplikatów oraz wybór
pakietów i obsługę płci. Umysł kupca przeszedł testy automatyczne; osobny
test manualny w grze nie został jeszcze potwierdzony.

## Co pozostało

1. Sklasyfikować pozostałe 135 rekordów: działanie narracyjne, wspólny
   mechanizm do podłączenia, zależność od przyszłej mechaniki lub niejasne
   zasady. Nie obiecywać automatyzacji decyzji MG.
2. Premie na pojedynczy test z zaznaczanym warunkiem, np. Po prostu tropiciel,
   Wyczulone zmysły i Zdobywanie informacji. Nie stosować ich globalnie.
3. Przerzuty, limity na sesję oraz ich ręczny reset; m.in. dokończenie
   Koleś zwany koniem. Nie utożsamiać sesji ani odpoczynku z upływem zegara.
4. Zmiany poziomu trudności, dodatkowe sukcesy, zamiana Współczynnika,
   manipulowanie kośćmi i ignorowanie wybranych kar.
5. Dalsze wybory i efekty czasowe, np. Totem, Maszyna do zabijania,
   Człowiek zwany koniem. Zachować koszt, warunki i skutki uboczne.
6. Zdolności zależne od walki wręcz, strzelania, pancerza, leczenia,
   pojazdów, reputacji i rozwoju podłączać wraz z tymi mechanikami.
7. Przejrzeć zgodność i różnice odpowiedników PERK/TRAIT. Nie zamieniać
   automatycznie wszystkich prefiksów; katalogi mogą mieć różne opisy.
8. Rozszerzać rozpoznawanie wymagań tylko na podstawie jednoznacznych danych.

## Zasady powrotu do prac

- Realizować grupy korzystające ze wspólnego mechanizmu, nie pojedyncze
  zdolności bez końca. Najpierw wskazać konkretny zakres i korzyść.
- Nie nadpisywać wartości bazowych i nie kasować historii ani Actorów.
- Testować dane obu katalogów i istniejące postacie; w razie rozbieżności
  pobrać raport rzeczywistego Actora zamiast zgadywać przyczynę.
- Nowe pola wyboru z pustą wartością początkową muszą dopuszczać ją jawnie
  (`blank: true` w Foundry 14).
