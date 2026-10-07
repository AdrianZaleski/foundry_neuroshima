// Stan egzemplarza jest niezależny od sprawności (zacięcia) oraz amunicji.
export function weaponHandlingState(actor, weapon) {
  const hands = actor.system.hands ?? {};
  const heldHands = [hands.left, hands.right].filter(id => id === weapon.id).length;
  const requiredHands = weapon.system.requiredHands === 2 ? 2 : 1;
  const reasons = [];
  if (!heldHands) reasons.push("Broń schowana");
  else if (heldHands < requiredHands) reasons.push("Wymaga obu dłoni");
  if (weapon.system.requiresPreparation && !weapon.system.prepared) reasons.push("Wymaga dodatkowego przygotowania wskazanego przez MG");
  if (weapon.system.safetyOn) reasons.push("Zabezpieczona");
  if (weapon.system.needsCycling) reasons.push("Wymaga przeładowania mechanizmu");
  if (weapon.system.jamState !== "ready") reasons.push("Zacięta");
  if (!(weapon.system.currentAmmunition > 0)) reasons.push("Brak amunicji");
  return { heldHands, requiredHands, canShoot: reasons.length === 0,
    locationLabel: heldHands === 2 ? "W obu dłoniach" : hands.left === weapon.id ? "W lewej dłoni" : hands.right === weapon.id ? "W prawej dłoni" : "Schowana",
    readinessLabel: reasons.length ? reasons.join(" • ") : "Gotowa do strzału" };
}

export function usableFirearms(actor) {
  return actor.items.filter(item => item.type === "weapon"
    && !["LAUNCHER", "PROJECTILE"].includes(item.system.weaponClass)
    && weaponHandlingState(actor, item).canShoot);
}

export function handlingSnapshot(actor, weapon, ammunition) {
  const system = weapon.system;
  return JSON.stringify({ hands: actor.system.hands ?? {}, weaponId: weapon.id,
    prepared: Boolean(system.prepared), requiresPreparation: Boolean(system.requiresPreparation), safetyOn: Boolean(system.safetyOn),
    needsCycling: Boolean(system.needsCycling), requiredHands: system.requiredHands ?? 1,
    currentAmmunition: system.currentAmmunition, magazineCapacity: system.magazineCapacity,
    ammunitionCode: system.ammunitionCode, loadedAmmunitionSourceCode: system.loadedAmmunitionSourceCode,
    jamState: system.jamState, reloadTime: system.reloadTime,
    ammunition: ammunition ? { id: ammunition.id, quantity: ammunition.system.quantity,
      symbol: ammunition.system.ammunitionSymbol, source: ammunition.system.sourceCode,
      weight: ammunition.system.unitWeightInKilograms } : null });
}

export function planWeaponHandling(actor, configuration) {
  if (configuration.code === "hands") {
    const current = actor.system.hands ?? {};
    if (JSON.stringify(current) !== configuration.snapshot) throw new Error("Przedmioty w dłoniach zmieniły się. Zadeklaruj zmianę ponownie.");
    const held = new Set([current.left, current.right]);
    const chosen = configuration.hands;
    if (!chosen || [chosen.left, chosen.right].some(id => id && (!held.has(id) || !actor.items.get(id)))) {
      throw new Error("Nową broń wprowadź do dłoni przez Dobądź broń. Tutaj możesz odłożyć przedmiot lub zmienić chwyt.");
    }
    return { actorUpdate: { "system.hands.left": chosen.left, "system.hands.right": chosen.right }, itemUpdates: [] };
  }
  const weapon = actor.items.get(configuration.weaponId);
  if (!weapon || weapon.type !== "weapon") throw new Error("Wybranej broni nie ma już na karcie.");
  const ammunition = configuration.ammunitionId ? actor.items.get(configuration.ammunitionId) : null;
  if (configuration.snapshot && handlingSnapshot(actor, weapon, ammunition) !== configuration.snapshot) {
    throw new Error("Stan broni, dłoni lub amunicji zmienił się podczas akcji. Przerwij ją i zadeklaruj ponownie.");
  }
  const state = weaponHandlingState(actor, weapon);
  const actorUpdate = {}, itemUpdates = [];
  const code = configuration.code;
  if (code === "drawWeapon") {
    if (!["left", "right", "both"].includes(configuration.grip)) throw new Error("Wybierz dłoń lub chwyt oburącz.");
    const selected = configuration.grip === "both" ? ["left", "right"] : [configuration.grip];
    if (selected.length < state.requiredHands) throw new Error("Ta broń wymaga obu dłoni.");
    for (const hand of selected) {
      const current = actor.system.hands?.[hand];
      if (current && current !== weapon.id && actor.items.get(current)) throw new Error("Wybrana dłoń jest zajęta. Najpierw odłóż trzymany przedmiot.");
      actorUpdate[`system.hands.${hand}`] = weapon.id;
    }
    for (const hand of ["left", "right"]) {
      if (!selected.includes(hand) && actor.system.hands?.[hand] === weapon.id) actorUpdate[`system.hands.${hand}`] = "";
    }
  } else {
    if (!state.heldHands) throw new Error("Najpierw dobądź tę broń.");
    if (code === "readyWeapon") {
      if (!weapon.system.requiresPreparation) throw new Error("Ta broń nie wymaga osobnego przygotowania. Sprawdź amunicję i zabezpieczenie.");
      itemUpdates.push({ _id: weapon.id, "system.prepared": true, "system.needsCycling": false });
    } else if (code === "safetyOff") {
      itemUpdates.push({ _id: weapon.id, "system.safetyOn": false });
    } else if (code === "pumpAction") {
      if (!weapon.system.requiresCycling || !weapon.system.needsCycling) throw new Error("Ta broń nie oczekuje ręcznego przeładowania mechanizmu po strzale.");
      itemUpdates.push({ _id: weapon.id, "system.needsCycling": false });
    } else if (["changeMagazine", "loadRevolverRound"].includes(code)) {
      const otherItem = [actor.system.hands?.left, actor.system.hands?.right]
        .some(id => id && id !== weapon.id && actor.items.get(id));
      if (otherItem) throw new Error("Przeładowanie wymaga wolnej dłoni pomocniczej. Odłóż drugi przedmiot.");
      if (!ammunition || ammunition.type !== "ammunition" || !(ammunition.system.quantity > 0)
        || !weapon.system.ammunitionCode?.trim()
        || ammunition.system.ammunitionSymbol?.trim() !== weapon.system.ammunitionCode.trim()) {
        throw new Error("Brak wybranego zapasu zgodnej amunicji.");
      }
      if (code === "loadRevolverRound" && weapon.system.weaponClass !== "REVOLVER") throw new Error("Ładowanie bębna dotyczy rewolweru.");
      const current = weapon.system.currentAmmunition;
      const missing = weapon.system.magazineCapacity - current;
      const amount = Number(configuration.amount);
      if (!Number.isInteger(amount) || amount < 1 || amount > missing || amount > ammunition.system.quantity
        || (code === "loadRevolverRound" && amount !== 1)) throw new Error("Nieprawidłowa liczba nabojów albo brak miejsca w magazynku.");
      if (current > 0 && weapon.system.loadedAmmunitionSourceCode !== ammunition.system.sourceCode) {
        throw new Error("W broni jest inny albo nieokreślony wariant amunicji. Nie można mieszać wariantów.");
      }
      itemUpdates.push({ _id: weapon.id, "system.currentAmmunition": current + amount,
        "system.loadedAmmunitionSourceCode": ammunition.system.sourceCode,
        "system.loadedAmmunitionUnitWeight": ammunition.system.unitWeightInKilograms ?? 0,
        "system.prepared": Boolean(weapon.system.prepared || !weapon.system.requiresPreparation), "system.needsCycling": false },
      { _id: ammunition.id, "system.quantity": ammunition.system.quantity - amount });
    } else throw new Error("Nieznana czynność obsługi broni.");
  }
  return { weapon, actorUpdate, itemUpdates };
}
