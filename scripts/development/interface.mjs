import { ATTRIBUTE_LABELS, SKILL_CONFIGURATION } from "../rolls/skill-roll.mjs";
import { escapeModifierText as escape } from "../effects/modifiers.mjs";
import { DEVELOPMENT_COSTS } from "./costs.mjs";
import { quoteDevelopment, prepareDevelopmentPurchase } from "./purchases.mjs";

const pending = new Set();
export async function purchaseDevelopment(actor) {
  if (!actor.isOwner || pending.has(actor.uuid)) return;
  pending.add(actor.uuid);
  try {
    const choices = [];
    for (const kind of ["attributes", "skills"]) {
      for (const [key, statistic] of Object.entries(actor.system[kind])) {
        const label = kind === "attributes" ? ATTRIBUTE_LABELS[key]
          : statistic.name || SKILL_CONFIGURATION[key]?.label || key;
        try {
          const quote = quoteDevelopment(actor, kind, key, DEVELOPMENT_COSTS);
          choices.push({ ...quote, label });
        } catch { /* Poziom bez ceny, limit lub już rozwinięty po tej sesji. */ }
      }
    }
    if (!choices.length) return ui.notifications.info("Brak dostępnych zakupów po tej sesji.");
    const selection = await foundry.applications.api.DialogV2.input({
      window: { title: "Rozwój za PD" }, position: { width: 620 },
      content: `<p>Po sesji ${actor.system.development.session}. Dostępne PD: ${actor.system.development.experiencePoints}.</p>
        <p>Zakup podnosi wartość bazową o 1. Premie z cech i efekty pozostają osobno. ${actor.system.development.ignoreSessionLimit ? "Limit podniesień po sesji wyłączony decyzją MG." : "Każdą wartość można podnieść raz po danej sesji."}</p>
        <label>Rozwijana wartość<select name="choice">${choices.map((q, i) => `<option value="${i}" ${q.affordable ? "" : "disabled"}>${escape(q.label)}: ${q.from} → ${q.to} — ${q.cost} PD${q.specialized ? " (Specjalizacja)" : ""}${q.affordable ? "" : " — brak PD"}</option>`).join("")}</select></label>
        <p>Nowa Umiejętność wymaga czasu nauki ustalonego z MG i odpowiedniego nauczyciela.</p>`,
      ok: { label: "Dalej" }, rejectClose: false, modal: true
    });
    if (!selection || selection.choice == null) return;
    const choice = choices[Number(selection.choice)];
    if (!choice?.affordable) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: `Zakup: ${choice.label}` },
      content: `<p>${escape(choice.label)}: <strong>${choice.from} → ${choice.to}</strong>.</p>
        <p>Koszt: <strong>${choice.cost} PD</strong>. Pozostanie: ${choice.balance - choice.cost} PD.</p>
        ${choice.kind === "skills" && choice.from === 0 ? "<p>Potwierdzając, potwierdzasz także uzgodnienie nauki tej Umiejętności z MG.</p>" : ""}`,
      yes: { label: "Kup rozwój" }, no: { label: "Anuluj" }, rejectClose: false, modal: true
    });
    if (confirmed !== true || !actor.isOwner) return;
    const update = prepareDevelopmentPurchase(actor, choice, DEVELOPMENT_COSTS, {
      id: foundry.utils.randomID(), timestamp: new Date().toISOString(), label: choice.label, userId: game.user.id
    });
    await actor.update(update);
    ui.notifications.info(`${choice.label}: poziom ${choice.to}, wydano ${choice.cost} PD.`);
  } catch (error) {
    ui.notifications.warn(error.message);
  } finally { pending.delete(actor.uuid); }
}

export async function toggleDevelopmentSessionLimit(actor) {
  if (!game.user.isGM || pending.has(actor.uuid)) return;
  await actor.update({ "system.development.ignoreSessionLimit": !actor.system.development.ignoreSessionLimit });
}

export async function nextDevelopmentSession(actor) {
  if (!game.user.isGM || pending.has(actor.uuid)) return;
  pending.add(actor.uuid);
  try {
    const session = actor.system.development.session;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Kolejna sesja rozwoju" },
      content: `<p>Rozpocząć rozliczanie sesji ${session + 1} dla ${escape(actor.name)}? Pozwoli to ponownie podnieść każdą wartość o 1. Historia zakupów pozostanie zachowana.</p>`,
      yes: { label: "Kolejna sesja" }, no: { label: "Anuluj" }, rejectClose: false, modal: true
    });
    if (confirmed === true && game.user.isGM && actor.system.development.session === session) await actor.update({ "system.development.session": session + 1 });
  } finally { pending.delete(actor.uuid); }
}
