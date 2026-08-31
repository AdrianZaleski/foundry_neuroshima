# Raport importu sztuczek i cech

## Źródło

- Arkusz: `Bronie prototyp`
- Zakładka `PERK`, zakres `A1:F994`
- Zakładka `TRAIT`, zakres `A1:E1000`
- Data importu: 2026-08-31

## Wynik

| Katalog | Typ Itemu | Liczba wpisów | Compendium |
| --- | --- | ---: | --- |
| `packs/catalogs/perks.json` | `perk` | 329 | `Neuroshima: Sztuczki` |
| `packs/catalogs/traits.json` | `trait` | 143 | `Neuroshima: Cechy` |

Wszystkie 472 dokumenty posiadają unikalny, stabilny identyfikator `_id` oraz unikalny `system.sourceCode`.

## Mapowanie danych

Zakładka `PERK`:

- `ID` → `system.sourceCode`
- `Ruleset` → `system.ruleset`
- `Name` → `name`
- `Requirements` → `system.requirements`
- `Effects description` → `system.effects`
- `Flavor text` → `system.description`

Zakładka `TRAIT`:

- `ID` → `system.sourceCode`
- `Name` → `name`
- `Description` → `system.effects`
- `Requirement` → `system.requirements`
- `Ruleset` → `system.ruleset`

## Rozstrzygnięcie duplikatu

Kod `TRAIT_REPUTACJA` występował w źródle dwa razy: dla profesji Medyk oraz Najemnik. Oba rekordy zostały zachowane jako:

- `TRAIT_REPUTACJA_CLASS_MEDYK`
- `TRAIT_REPUTACJA_CLASS_NAJEMNIK`

Oryginalny kod i informacja o korekcie pozostają zapisane we flagach `flags.neuroshima` każdego z tych dokumentów.
