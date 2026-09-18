export const BRUISE_NAMES = {
  S_D: "Siniak Drobny",
  S_L: "Siniak Lekki",
  S_C: "Siniak Ciężki",
  S_K: "Siniak Krytyczny"
};

// Rozwijamy wyłącznie skróty, zachowując własne nazwy nadane przez MG.
export function expandBruiseName(name) {
  const match = /^s_?([dlck])$/i.exec(String(name).trim());
  return match ? BRUISE_NAMES[`S_${match[1].toUpperCase()}`] : name;
}
