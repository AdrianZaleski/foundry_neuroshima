import { treatmentPlan, applyTreatmentResult } from "./treatment.mjs";
import { rollSkill } from "../rolls/skill-roll.mjs";
import { escapeModifierText as escape } from "../effects/modifiers.mjs";
const pending = new Set();

export async function treatInjury(patient, injuryId) {
  const injury = patient.items.get(injuryId);
  if (!patient.isOwner || injury?.type !== "injury" || pending.has(injury.uuid)) return;
  pending.add(injury.uuid);
  try {
    const healers = [...game.actors].filter(actor => actor.isOwner && actor.type === "character");
    if (!healers.some(actor => actor.uuid === patient.uuid)) healers.push(patient);
    const data = await foundry.applications.api.DialogV2.input({
      window: { title: `Opatrzenie rany — ${patient.name}` }, position: { width: 580 },
      content: `<p><strong>${escape(injury.name)}</strong>: kara ${injury.system.penaltyPercent}%.</p>
        <label>Medyk<select name="healer">${healers.map((actor, i) => `<option value="${i}">${escape(actor.name)}</option>`).join("")}</select></label>
        <label>Zabieg<select name="method"><option value="firstAid">Pierwsza pomoc — jedna tura</option><option value="healing">Leczenie ran — około kwadransa</option></select></label>
        <label><input type="checkbox" name="underFire"> W sercu walki, pod ostrzałem (+40%)</label>
        <label>Pomoc sprzętu (ustala MG)<select name="equipment"><option value="0">Brak</option><option value="-10">−10%</option><option value="-20">−20%</option><option value="-30">−30%</option></select></label>
        <label><input type="checkbox" name="doubleTime"> Podwójny czas zabiegu (−20%)</label>
        <p>Test używa ran i modyfikatorów medyka. Czas zabiegu rozliczacie w grze. Zmiana kary zostanie zapisana dopiero po rzucie.</p>`,
      ok: { label: "Przejdź do testu" }, rejectClose: false, modal: true
    });
    if (!data) return;
    const healer = healers[Number(data.healer)];
    if (!healer?.isOwner) return;
    const plan = treatmentPlan(injury, data.method);
    const selected = value => value === true || value === "on" || value === "true";
    const equipment = Number(data.equipment);
    if (![0, -10, -20, -30].includes(equipment)) return;
    const conditions = (selected(data.underFire) ? 40 : 0) + equipment - (selected(data.doubleTime) ? 20 : 0);
    const duration = plan.method === "firstAid" ? (selected(data.doubleTime) ? "2 tury" : "1 tura") : (selected(data.doubleTime) ? "około 30 minut" : "około 15 minut");
    const snapshot = JSON.stringify(injury.toObject().system);
    const result = await rollSkill(healer, plan.method === "firstAid" ? "pierwszaPomoc" : "leczenieRan", {
      fixedTestType: "closed", fixedDifficultyIndex: plan.difficulty, fixedPenaltyPercent: conditions,
      testTitle: `Opatrzenie: ${escape(patient.name)} — ${escape(injury.name)}`,
      configurationTitle: `Opatrzenie rany (${duration})`
    });
    if (!result) return;
    if (!patient.isOwner || !healer.isOwner || patient.items.get(injuryId) !== injury || JSON.stringify(injury.toObject().system) !== snapshot) {
      ui.notifications.warn("Rana zmieniła się podczas testu. Wynik jest na czacie, ale nie zmieniono kary — rozstrzygnij z MG.");
      return;
    }
    const before = injury.system.penaltyPercent;
    const update = applyTreatmentResult(injury, plan, result.testPassed, { timestamp: new Date().toISOString(), healer: healer.name, conditions, duration });
    await injury.update(update);
    await foundry.documents.ChatMessage.create({
      speaker: foundry.documents.ChatMessage.getSpeaker({ actor: healer }),
      content: `<p><strong>${plan.method === "firstAid" ? "Pierwsza pomoc" : "Leczenie ran"}</strong>: ${escape(healer.name)} → ${escape(patient.name)}, ${escape(injury.name)}.</p><p>${result.testPassed ? "Sukces" : "Porażka"}. Kara rany: ${before}% → ${update["system.penaltyPercent"]}%. Czas: ${duration}.</p>`
    });
    ui.notifications.info(`${injury.name}: ${result.testPassed ? "zabieg udany" : "zabieg nieudany"}, kara ${before}% → ${update["system.penaltyPercent"]}%.`);
  } catch (error) { ui.notifications.warn(error.message); }
  finally { pending.delete(injury.uuid); }
}
