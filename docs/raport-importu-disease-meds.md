# Raport importu DISEASE i MEDS

## Zakres

- Źródło: arkusz Google Sheets `Bronie prototyp`.
- Zakładka `DISEASE`: zakres odczytu `A1:AC988`.
- Zakładka `MEDS`: zakres odczytu `A1:Y1005`.
- Zaimportowano 21 chorób oraz 39 leków.

## Choroby

- Wszystkie rekordy mają unikalny kod i nazwę.
- Każda choroba zawiera opis trzech etapów oraz stanu terminalnego.
- Nienazwane kolumny D, F i H zawierają czytelne podsumowania mechaniczne etapów i zostały zachowane.
- Techniczne kody efektów występują tylko dla trzech chorób, a komplet trzech kodów tylko dla dwóch.
- Stan terminalny nie posiada w arkuszu osobnego technicznego kodu efektu.
- Jedna choroba nie ma opisu leku lub leczenia.

## Leki

- Wszystkie 39 rekordów ma unikalny kod i nazwę.
- 36 leków wskazuje istniejącą chorobę przez jej kod.
- Trzy leki są ogólne i nie mają przypisanej choroby: witaminy, leki przeciwbólowe oraz morfina.
- Jeden lek nie ma określonej wielkości opakowania; w modelu otrzymał wartość 0 i ostrzeżenie importu.
- Jeden lek nie ma opisu przedmiotu.
- Surowy kod efektu występuje w 10 rekordach, a czas działania tylko przy morfinie.

## Decyzje importu

- Zachowano pisownię, treść oraz techniczne identyfikatory ze źródła, również w przypadku literówek.
- Nie naprawiano automatycznie niejednolitych kodów efektów.
- Pełne opakowanie leku w Compendium rozpoczyna z liczbą dawek równą wielkości opakowania.
- Wpis przeciągnięty do Actora staje się niezależną kopią, więc etap choroby i liczba dawek mogą być bezpiecznie zmieniane.
