import { weaponHandlingState } from "../combat/weapon-handling-state.mjs";
import { supportsAutomaticFire } from "../combat/burst-fire.mjs";
import { isUnconscious, UNCONSCIOUS_ACTION_MESSAGE } from "../combat/action-access.mjs";

// Podpowiedź wynika z aktualnego stanu. Nie narzucamy pełnej listy czynności
// broni, która potrzebuje tylko jednego kroku albo jest już gotowa.
export function prepareWeaponGuidance(actor, weapon, combatStatus = {}, combatStarted = false) {
  const state = weaponHandlingState(actor, weapon);
  const system = weapon.system;
  const steps = [];
  const add = (action, label, explanation, duration) => steps.push({ action, label, explanation, duration });
  const hands = actor.system.hands ?? {};
  const heldOther = [hands.left, hands.right].filter(id => id && id !== weapon.id && actor.items.get(id));
  if (!state.heldHands) {
    if (heldOther.length > 2 - state.requiredHands) add("hands", "Zwolnij dłoń", "Odłóż trzymany przedmiot, aby zrobić miejsce na broń.", null);
    add("drawWeapon", "Dobądź broń", "Przenieś broń z ekwipunku do wolnej dłoni. Jeśli jest załadowana i odbezpieczona, nie potrzebuje osobnego przygotowania.", 2);
  } else if (state.heldHands < state.requiredHands) {
    add("hands", "Chwyć broń oburącz", "Ten egzemplarz ma ustawiony wymóg obu dłoni. Wybierz tę samą broń w obu polach dłoni.", null);
  }
  if (system.jamState !== "ready") add("jam", "Usuń zacięcie", "Broń jest zacięta. Samo uzupełnienie amunicji nie usunie zacięcia.", null);
  if (!(system.currentAmmunition > 0)) {
    if (heldOther.length && state.heldHands) add("hands", "Zwolnij dłoń pomocniczą", "Odłóż drugi przedmiot na czas ładowania broni.", null);
    add("changeMagazine", "Załaduj amunicję", "Przenieś naboje z posiadanego zapasu do broni. Naboje pojawią się w niej po zakończeniu akcji.", system.reloadTime || null);
  }
  if (system.requiresPreparation && !system.prepared) add("readyWeapon", "Wykonaj dodatkowe przygotowanie", system.preparationDescription || "MG ustawił dodatkowy wymóg dla tego egzemplarza. Uzgodnij czynność z MG; jej opis można wpisać w edycji broni.", 2);
  if (system.safetyOn) add("safetyOff", "Odbezpiecz broń", "Wyłącz zabezpieczenie. Ta czynność nie ładuje amunicji.", 1);
  if (system.needsCycling && system.currentAmmunition > 0) add("pumpAction", "Przeładuj mechanizm", "Po poprzednim strzale trzeba wykonać ręczny cykl mechanizmu. Nie jest to uzupełnianie zapasu nabojów.", 1);
  const supported = !["LAUNCHER", "PROJECTILE"].includes(system.weaponClass);
  const next = steps[0] ?? { action: "shot", label: "Strzel", explanation: supportsAutomaticFire(weapon)
    ? "Broń jest gotowa. Wybierz cel i tryb: strzał, celowanie, seria lub ogień ciągły."
    : "Broń jest gotowa do strzału zwykłego lub celowanego. Serie wymagają zapisanego trybu A i poprawnej szybkostrzelności.", duration: 1 };
  let unavailable = "";
  if (isUnconscious(actor)) unavailable = UNCONSCIOUS_ACTION_MESSAGE;
  else if (!supported && next.action === "shot") unavailable = "Ta klasa broni nie ma jeszcze automatycznego rozliczania strzału.";
  else if (combatStarted && !combatStatus.canDeclareAction) {
    unavailable = combatStatus.action?.isCurrent ? `Trwa akcja: ${combatStatus.action.name}. ${combatStatus.action.timingDescription ?? ""}`
      : combatStatus.inCombat ? "Poczekaj na swoją kolejkę w Combat Trackerze." : "Dodaj postać do aktywnej walki, aby zadeklarować akcję.";
  } else if (next.action === "shot" && !combatStarted) unavailable = "Broń gotowa. Strzał rozliczysz po rozpoczęciu walki w Combat Trackerze.";
  if (!unavailable && next.action === "changeMagazine" && !actor.items.some(item => item.type === "ammunition" && item.system.quantity > 0
    && system.ammunitionCode?.trim() && item.system.ammunitionSymbol?.trim() === system.ammunitionCode.trim())) unavailable = "Brak zgodnej amunicji w ekwipunku. Najpierw dodaj jej zapas.";
  if (!unavailable && next.action === "jam" && combatStarted && system.jamState !== "minor") unavailable = "To zacięcie wymaga naprawy poza walką. Użyj innej broni.";
  const cost = !combatStarted && next.action !== "shot" ? "poza walką: od razu"
    : next.action === "shot" ? "1–3 seg., zależnie od trybu strzału" : next.duration ? `${next.duration} seg.` : "czas ustalisz w oknie czynności";
  return { ...state, id: weapon.id, name: weapon.name, ammunition: `${system.currentAmmunition} / ${system.magazineCapacity}`,
    steps, next, cost, unavailable, disabled: Boolean(unavailable), supported,
    actionsBlocked: isUnconscious(actor) || (combatStarted && !combatStatus.canDeclareAction),
    canTopUp: state.heldHands > 0 && system.currentAmmunition > 0 && system.currentAmmunition < system.magazineCapacity };
}
