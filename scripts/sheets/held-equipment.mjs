const HANDHELD_TYPES = new Set(["weapon", "meleeWeapon", "equipment", "ammunition", "medicine", "armor"]);

export function prepareHeldEquipment(actor) {
  const items = actor.items.filter(item => HANDHELD_TYPES.has(item.type)
    && (item.system.quantity === undefined || item.system.quantity > 0));
  const hands = actor.system.hands ?? {};
  const left = items.find(item => item.id === hands.left);
  const right = items.find(item => item.id === hands.right);
  return {
    items,
    leftId: left?.id ?? "", rightId: right?.id ?? "",
    leftName: left?.name ?? "Wolna", rightName: right?.name ?? "Wolna",
    bothHands: Boolean(left && right && left.id === right.id)
  };
}

export async function configureHeldEquipment(actor) {
  const current = prepareHeldEquipment(actor);
  const escape = foundry.utils.escapeHTML;
  const options = selected => '<option value="">Wolna dłoń</option>' + current.items
    .map(item => `<option value="${escape(item.id)}" ${item.id === selected ? "selected" : ""}>${escape(item.name)}</option>`).join("");
  const result = await foundry.applications.api.DialogV2.input({
    window: { title: "Przedmioty w dłoniach" },
    content: `<div class="form-group"><label>Lewa dłoń</label><select name="left">${options(current.leftId)}</select></div>
      <div class="form-group"><label>Prawa dłoń</label><select name="right">${options(current.rightId)}</select></div>
      <p>Wybierz ten sam przedmiot w obu polach, jeśli trzymasz go oburącz. Puste pole oznacza wolną dłoń.</p>`,
    ok: { label: "Zapisz" }, rejectClose: false, modal: true
  });
  if (!result) return;
  // The inventory may have changed while the dialog was open.
  const available = new Set(prepareHeldEquipment(actor).items.map(item => item.id));
  const left = String(result.left ?? ""), right = String(result.right ?? "");
  if ([left, right].some(id => id && !available.has(id))) {
    ui.notifications.warn("Wybrany przedmiot nie jest już dostępny w ekwipunku.");
    return;
  }
  await actor.update({ "system.hands.left": left, "system.hands.right": right });
}
