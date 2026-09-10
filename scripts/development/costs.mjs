// Koszty: zdjęcie tabeli „Rozwój Bohatera” dostarczone 2026-09-10.
// Specjalizacja i Współczynnik 20: karta Roll20, Umiejetnosci.html, Tabela PD.
// Nie przenosimy błędnie przesuniętych kosztów niespecjalizowanych z Roll20.
const skillValues = [200, 60, 90, 200, 250, 300, 350, 800, 900, 1000, 1100, 2400];
export const DEVELOPMENT_COSTS = {
  skills: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, skillValues[i] ?? (i + 1) * 200])),
  specializedSkills: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, i === 0 ? 200 : (skillValues[i] ?? (i + 1) * 200) * 0.8])),
  attributes: Object.fromEntries(Array.from({ length: 35 }, (_, i) => {
    const level = i + 6;
    return [level, level * (level <= 15 ? 100 : level <= 19 ? 200 : 300)];
  }))
};
