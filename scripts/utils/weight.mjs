// Wszystkie masy sumujemy w kilogramach, niezależnie od jednostki wybranej
// na karcie przedmiotu. Dzięki temu można poprawnie dodać broń i amunicję.
export function convertWeightToKilograms(weight, weightUnit) {
  if (weightUnit === "g") return weight / 1000;

  return weight;
}

// Trzy miejsca po przecinku pozwalają zachować dokładność do jednego grama.
// Zaokrąglenie usuwa również typowe niedokładności liczb dziesiętnych JavaScriptu.
export function roundWeightInKilograms(weightInKilograms) {
  return Math.round(weightInKilograms * 1000) / 1000;
}

// Ten słownik zasila listy wyboru na kartach Itemów.
export const weightUnitOptions = {
  g: "g",
  kg: "kg"
};
