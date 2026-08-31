# Raport importu broni ręcznej

## Źródło

- Arkusz: `Bronie prototyp`
- Zakładka `MELEE`, zakres `A1:AE1000`
- Data importu: 2026-08-31

## Wynik

- Utworzono 17 dokumentów typu `meleeWeapon`.
- Katalog zapisano w `packs/catalogs/melee-weapons.json`.
- Compendium nosi nazwę `Neuroshima: Broń ręczna`.
- Wszystkie dokumenty posiadają unikalny, stabilny identyfikator `_id` oraz kod `system.sourceCode`.
- Pominięto 14 wierszy zawierających numer ID, lecz pozbawionych nazwy broni.

## Mapowanie danych

- `ID` → `flags.neuroshima.sourceId` oraz kod `MELEE_<ID>`
- `Nazwa` → `name`
- `Typ` → `system.weaponType`
- `Punkty Przebicia` → `system.armorPenetration`
- `Bonus w ataku` → `system.attackBonus`
- `Bonus w obronie` → `system.defenseBonus`
- `Bonus przeciw wielu przeciwnikom` → `system.multipleOpponentsBonus`
- `Wymagana Budowa` → `system.requiredBuild`
- `Bonus do Inicjatywy` → `system.initiativeBonus`
- kolumny progów Siły/Budowy → `system.damageByBuild`

## Jakość źródła

- Kolumna `Typ` jest pusta we wszystkich nazwanych rekordach.
- Profil obrażeń występuje w 3 z 17 nazwanych rekordów.
- Wartości obrażeń używają kilku wariantów zapisu, między innymi `D_sD`, `D_D`, `D`, `L` oraz `C`.
- Pustą kolumnę oraz powtórzony nagłówek `Bonus do inicjatywy` na końcu danych pominięto, ponieważ nie zawierają wartości.
- Dane nie zostały interpretowane ani poprawiane; dokładny tekst źródłowy pozostaje dostępny w Itemach.
