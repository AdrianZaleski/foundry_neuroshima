import { HEALING_MODES, planHealing, healingUpdate } from "./healing.mjs";
import { escapeModifierText as esc } from "../effects/modifiers.mjs";
let busy = false;
export async function healOverTime(actor, group = false) {
  if (busy || (group ? !game.user.isGM : !actor.isOwner)) return;
  busy = true;
  try {
    const actors = group ? [...game.actors].filter(a => a.type === "character" && a.isOwner) : [actor];
    const data = await foundry.applications.api.DialogV2.input({
      window: { title: group ? "Gojenie wielu postaci (MG)" : "Gojenie ran — upływ czasu" }, position: { width: 620 },
      content: `<label>Liczba dni<input type="number" name="days" value="1" min="1" max="3650" step="1"></label>
        <p>Rozliczaj tylko dni uzgodnione w grze, których jeszcze nie zapisano. Siniaki: zawsze −30 punktów kary dziennie; inne rany: −5 dziennie z odpoczynkiem, −5 co dwa dni bez odpoczynku, 0 przy zaniedbaniu.</p>
        ${actors.map((a, i) => `<p><label><input type="checkbox" name="actor${i}" ${group ? "" : "checked"}>${esc(a.name)}</label>
          <select name="mode${i}">${Object.entries(HEALING_MODES).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></p>`).join("")}`,
      ok: { label: "Podgląd zmian" }, rejectClose: false, modal: true
    });
    if (!data) return;
    const selected = value => value === true || value === "on" || value === "true";
    const plans = actors.flatMap((a, i) => selected(data[`actor${i}`]) ? [{ actor: a,
      injuries: [...a.items].filter(item => item.type === "injury" && item.system.penaltyPercent > 0).map(item => ({ item, snapshot: JSON.stringify(item.toObject().system), plan: planHealing(item, Number(data.days), data[`mode${i}`]) })) }] : []);
    if (!plans.some(p => p.injuries.length)) return ui.notifications.info("Brak ran z karą u wybranych postaci.");
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Zatwierdź gojenie ran" }, position: { width: 620 },
      content: `<div style="max-height:55vh;overflow:auto">${plans.map(p => `<h3>${esc(p.actor.name)}</h3>${p.injuries.map(({ item, plan }) => `<p>${esc(item.name)}: ${plan.before}% → ${plan.after}%; ${esc(plan.mode)}, dni: ${plan.days}. Zapas dnia bez odpoczynku: ${plan.pendingDay}.</p>`).join("")}`).join("")}</div>`,
      yes: { label: "Zapisz gojenie" }, no: { label: "Anuluj" }, rejectClose: false, modal: true
    });
    if (confirmed !== true || (group && !game.user.isGM)) return;
    for (const p of plans) {
      if (!p.actor.isOwner || p.injuries.some(({ item, snapshot }) => p.actor.items.get(item.id) !== item || JSON.stringify(item.toObject().system) !== snapshot)) throw new Error("Dane postaci zmieniły się. Otwórz podgląd ponownie.");
    }
    const timestamp = new Date().toISOString();
    for (const p of plans) {
      if (!p.injuries.length) continue;
      await p.actor.updateEmbeddedDocuments("Item", p.injuries.map(({ item, plan }) => healingUpdate(item, plan, game.user.id, timestamp)));
      ui.notifications.info(`${p.actor.name}: zapisano gojenie za ${data.days} dni.`);
    }
  } catch (error) { ui.notifications.warn(error.message); }
  finally { busy = false; }
}
