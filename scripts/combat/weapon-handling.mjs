import { COMBAT_ACTIONS } from "./action-catalog.mjs";
import { declareSegmentAction, prepareActorCombatStatus, markCurrentSegmentActionResolved } from "./segments.mjs";
import { handlingSnapshot, planWeaponHandling, weaponHandlingState } from "./weapon-handling-state.mjs";
import { assertCombatAction } from "./action-access.mjs";

const pending = new Set();
const openRequests = new Set();
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));

export async function requestHeldEquipmentChange(actor, hands, duration, snapshot) {
  try {
    requireHandlingAccess(actor);
    if (!Number.isSafeInteger(duration) || duration < 1) throw new Error("Podaj koszt zmiany w segmentach uzgodniony z MG.");
    const configuration = { id: foundry.utils.randomID(), code: "hands", hands, snapshot };
    planWeaponHandling(actor, configuration);
    const declared = await declareSegmentAction(actor, "Zmiana chwytu / odłożenie przedmiotu", duration,
      { actionCode: "hands", effectCode: "weaponHandling", handlingConfiguration: configuration });
    if (declared && duration === 1) await resolveWeaponHandling(actor);
    return declared;
  } catch (error) { ui.notifications.warn(error.message); return false; }
}

function requireHandlingAccess(actor) {
  assertCombatAction(actor);
  if (!actor.isOwner) throw new Error("Nie masz uprawnień do tej postaci.");
  if (!game.combat?.started) return false;
  const status = prepareActorCombatStatus(actor);
  if (!status.canDeclareAction) throw new Error("Obsługę broni zadeklaruj w wolnym segmencie swojej kolejki.");
  return true;
}

export async function requestWeaponHandling(actor, code, weaponId = "") {
  const key = actor.uuid ?? actor.id;
  if (openRequests.has(key)) return false;
  openRequests.add(key);
  try {
    const inCombat = requireHandlingAccess(actor);
    const definition = COMBAT_ACTIONS[code];
    if (definition?.effectCode !== "weaponHandling") return false;
    const weapons = actor.items.filter(item => item.type === "weapon"
      && (code === "drawWeapon" || weaponHandlingState(actor, item).heldHands > 0)
      && (code !== "readyWeapon" || (item.system.requiresPreparation && !item.system.prepared))
      && (code !== "safetyOff" || item.system.safetyOn)
      && (code !== "pumpAction" || (item.system.requiresCycling && item.system.needsCycling))
      && (code !== "loadRevolverRound" || item.system.weaponClass === "REVOLVER"));
    let weapon = weapons.find(item => item.id === weaponId);
    if (weaponId && !weapon) throw new Error("Najpierw dobądź wybraną broń.");
    if (!weapon) {
      if (!weapons.length) throw new Error("Brak dostępnej broni. Najpierw dodaj ją do ekwipunku lub dobądź.");
      const choice = await foundry.applications.api.DialogV2.input({
        classes: ["neuroshima-weapon-handling-dialog"],
        window: { title: definition.name },
        content: `<label>Broń<select name="weaponId">${weapons.map(item => `<option value="${escape(item.id)}">${escape(item.name)}</option>`).join("")}</select></label>`,
        ok: { label: "Dalej" }, rejectClose: false, modal: true
      });
      if (!choice) return false;
      weapon = actor.items.get(String(choice.weaponId));
      if (!weapon || !weapons.includes(weapon)) return false;
    }
    const reload = ["changeMagazine", "loadRevolverRound"].includes(code);
    const supplies = reload ? actor.items.filter(item => item.type === "ammunition" && item.system.quantity > 0
      && weapon.system.ammunitionCode?.trim() && item.system.ammunitionSymbol?.trim() === weapon.system.ammunitionCode.trim()) : [];
    if (reload && !supplies.length) throw new Error("Brak zgodnej amunicji w ekwipunku.");
    const duration = code === "changeMagazine" ? Number(weapon.system.reloadTime) : definition.duration;
    const count = reload ? Math.min(code === "loadRevolverRound" ? 1 : Infinity,
      weapon.system.magazineCapacity - weapon.system.currentAmmunition, supplies[0].system.quantity) : 0;
    if (reload && count <= 0) throw new Error("Magazynek jest pełny albo nie ma określonej pojemności.");
    const state = weaponHandlingState(actor, weapon);
    const explanation = {
      readyWeapon: weapon.system.preparationDescription || "MG wymaga dodatkowej czynności dla tego egzemplarza. Jej opis można wpisać w edycji broni. To nie jest celowanie ani ładowanie amunicji.",
      safetyOff: "Wyłączasz zabezpieczenie załadowanej broni. Nie dodaje to nabojów i nie usuwa zacięcia.",
      pumpAction: "Wykonujesz ręczny cykl mechanizmu wymagany po poprzednim strzale. Nie uzupełniasz magazynka ani nie zużywasz dodatkowego naboju."
    }[code];
    const rightOccupied = actor.system.hands?.right && actor.system.hands.right !== weapon.id && actor.items.get(actor.system.hands.right);
    const answer = await foundry.applications.api.DialogV2.input({
      classes: ["neuroshima-weapon-handling-dialog"],
      window: { title: `${definition.name}: ${weapon.name}` },
      content: `<p>${escape(state.locationLabel)} — ${escape(state.readinessLabel)}</p>
        ${explanation ? `<p>${escape(explanation)}</p>` : ""}
        ${code === "drawWeapon" ? `<label>Chwyt<select name="grip">${state.requiredHands === 1 ? `<option value="right">Prawa dłoń</option><option value="left" ${rightOccupied ? 'selected' : ''}>Lewa dłoń</option>` : ''}<option value="both">Obie dłonie</option></select></label><p>Wybrane dłonie muszą być wolne. Przenosisz broń do dłoni; jej amunicja i zabezpieczenie pozostają bez zmian.</p>` : ""}
        ${reload ? `<label>Zapas amunicji<select name="ammunitionId">${supplies.map(item => `<option value="${escape(item.id)}">${escape(item.name)} (${item.system.quantity} szt.)</option>`).join("")}</select></label>
          <label>Liczba nabojów<input name="amount" type="number" min="1" max="${code === "loadRevolverRound" ? 1 : weapon.system.magazineCapacity - weapon.system.currentAmmunition}" step="1" value="${count}" required></label><p>Uzupełnienie magazynka zachowuje pozostałe naboje. Nie miesza wariantów amunicji.</p>` : ""}
        ${duration > 0 ? `<p>Czas: <strong>${duration} seg.</strong></p>` : '<label>Czas w segmentach — ustal z MG<input name="duration" type="number" min="1" step="1" required></label>'}
        <p>${inCombat ? "Stan zmieni się po zakończeniu całej akcji. Przerwanie nie wykona czynności." : "Poza walką zatwierdzenie wykona czynność od razu."}</p>`,
      ok: { label: inCombat ? "Zadeklaruj czynność" : "Wykonaj" }, rejectClose: false, modal: true
    });
    if (!answer) return false;
    if (requireHandlingAccess(actor) !== inCombat) throw new Error("Stan walki zmienił się. Otwórz czynność ponownie.");
    const configuration = { id: foundry.utils.randomID(), code, weaponId: weapon.id,
      weaponName: weapon.name, grip: String(answer.grip ?? ""), amount: reload ? Number(answer.amount) : 0,
      ammunitionId: reload ? String(answer.ammunitionId) : "" };
    const finalDuration = duration > 0 ? duration : Number(answer.duration);
    if (!Number.isSafeInteger(finalDuration) || finalDuration < 1) throw new Error("Podaj dodatnią liczbę segmentów.");
    // Walidacja przed deklaracją zapobiega zajęciu segmentu niewykonalną akcją.
    planWeaponHandling(actor, configuration);
    configuration.snapshot = handlingSnapshot(actor, weapon, actor.items.get(configuration.ammunitionId));
    if (!inCombat) return applyWeaponHandling(actor, configuration);
    const declared = await declareSegmentAction(actor, `${definition.name}: ${weapon.name}`, finalDuration,
      { ...definition, actionCode: code, handlingConfiguration: configuration });
    if (declared && finalDuration === 1) await resolveWeaponHandling(actor);
    return declared;
  } catch (error) {
    ui.notifications.warn(error.message);
    return false;
  } finally { openRequests.delete(key); }
}

// Potwierdzenie wykonania zapisujemy razem ze zmienianymi danymi. Ponowienie
// po błędzie zapisu flagi Trackera nie przenosi amunicji po raz drugi.
export async function applyWeaponHandling(actor, configuration) {
  assertCombatAction(actor);
  if (!actor.isOwner) throw new Error("Nie masz uprawnień do tej postaci.");
  const receiptDocument = configuration.code === "drawWeapon" || configuration.code === "hands"
    ? actor : actor.items.get(configuration.weaponId);
  if (receiptDocument?.getFlag?.("neuroshima", "weaponHandlingReceipt") === configuration.id) return true;
  const { actorUpdate, itemUpdates } = planWeaponHandling(actor, configuration);
  if (itemUpdates.length) {
    itemUpdates[0]["flags.neuroshima.weaponHandlingReceipt"] = configuration.id;
    await actor.updateEmbeddedDocuments("Item", itemUpdates);
  } else {
    await actor.update({ ...actorUpdate, "flags.neuroshima.weaponHandlingReceipt": configuration.id });
  }
  return true;
}

export async function resolveWeaponHandling(actor) {
  const status = prepareActorCombatStatus(actor);
  const action = status.action;
  if (!actor.isOwner || !status.isActiveTurn || !action?.canResolveHandling) return false;
  const configuration = action.handlingConfiguration;
  if (!configuration || pending.has(configuration.id)) return false;
  pending.add(configuration.id);
  try {
    await applyWeaponHandling(actor, configuration);
    await markCurrentSegmentActionResolved(actor, "Wykonano czynność obsługi broni");
    await foundry.documents.ChatMessage.create({ speaker: foundry.documents.ChatMessage.getSpeaker({ actor }),
      content: `<strong>${escape(actor.name)}</strong>: ${escape(action.name)} — wykonano.${configuration.ammunitionId ? ` Załadowano ${configuration.amount} szt. amunicji.` : ""}` });
    return true;
  } catch (error) {
    ui.notifications.warn(error.message);
    return false;
  } finally { pending.delete(configuration.id); }
}
