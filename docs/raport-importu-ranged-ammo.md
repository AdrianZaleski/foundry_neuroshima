# Raport importu RANGED i AMMO

Źródło: arkusz „Bronie prototyp”.

- Zakładka `RANGED`: 232 wpisy broni.
- Zakładka `AMMO`: 48 wpisów amunicji.
- Rodziny kompatybilności: 41.
- Powtórzone kody źródłowe: brak.
- Broń wskazująca nieistniejącą rodzinę amunicji: brak.

## Poprawiona niezgodność

Wpis `WP_SW38`, „Trzydziestka ósemka (S&W)”, miał wcześniej w kolumnie
`Price` wartość tekstową `L`. Wartość została poprawiona w arkuszu źródłowym
i katalogu JSON na cenę `35`. Ostrzeżenie importu zostało usunięte.

## Aktualny układ RANGED

- Zakładka nie zawiera już kolumn `ID code` i `Ruleset`.
- Kolumna `5E obrażenia` nie należy do tworzonego systemu i jest pomijana.
- Istniejące kody źródłowe broni zachowujemy w repozytorium.
- Kolejne aktualizacje arkusza dopasowujemy po unikalnej nazwie broni.
- Dla nowej broni kod źródłowy nadajemy raz w repozytorium i zachowujemy go
  podczas następnych aktualizacji.
