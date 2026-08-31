# Raport importu pochodzeń, profesji i specjalizacji

## Źródło

- Arkusz: `Bronie prototyp`
- Zakładka `ORIGIN`, zakres `A1:E1000`
- Zakładka `CLASS`, zakres `A1:E1000`
- Zakładka `SPECIALIZATION`, zakres `A1:D1000`
- Data importu: 2026-08-31

## Wynik

| Katalog | Typ Itemu | Liczba wpisów | Compendium |
| --- | --- | ---: | --- |
| `packs/catalogs/origins.json` | `origin` | 13 | `Neuroshima: Pochodzenia` |
| `packs/catalogs/professions.json` | `profession` | 30 | `Neuroshima: Profesje` |
| `packs/catalogs/specializations.json` | `specialization` | 4 | `Neuroshima: Specjalizacje` |

Wszystkie 47 dokumentów posiada unikalny, stabilny identyfikator `_id` oraz unikalny `system.sourceCode`.

## Mapowanie danych

Zakładka `ORIGIN`:

- `ID` → `system.sourceCode`
- `Ruleset` → `system.ruleset`
- `Name` → `name`
- `Description` → `system.description`
- `Bonus` → `system.bonus`

Zakładka `CLASS`:

- `ID` → `system.sourceCode`
- `Ruleset` → `system.ruleset`
- `Name` → `name`
- `Flavor text` → `system.flavorText`
- `Description` → `system.description`

Zakładka `SPECIALIZATION`:

- `ID` → `system.sourceCode`
- `Ruleset` → `system.ruleset`
- `Name` → `name`
- `Description` → `system.description`

## Powiązanie z Actorem

Actor przechowuje stabilny kod wybranego wpisu katalogowego. Karta pobiera nazwę, opis, tekst fabularny i bonus z indeksu właściwego Compendium. Osobne pola tekstowe pozostają dostępne dla własnych wariantów użytkownika.
