# Raport importu RANGED i AMMO

Źródło: arkusz „Bronie prototyp”.

- Zakładka `RANGED`: 231 wpisów broni.
- Zakładka `AMMO`: 47 wpisów amunicji.
- Rodziny kompatybilności: 40.
- Powtórzone kody źródłowe: brak.
- Broń wskazująca nieistniejącą rodzinę amunicji: brak.

## Niezgodność zachowana podczas importu

Wpis `WP_SW38`, „Trzydziestka ósemka (S&W)”, ma w kolumnie `Price`
wartość tekstową `L`. Model Foundry wymaga w tym miejscu liczby. W katalogu
ustawiono cenę `0`, a oryginalną wartość zapisano we fladze
`flags.neuroshima.importWarnings` danego Itemu. Docelowa cena wymaga
potwierdzenia zamiast zgadywania.
