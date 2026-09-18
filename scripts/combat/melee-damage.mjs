import { calculateAttributeValue, escapeModifierText as escape } from "../effects/modifiers.mjs";
import { resolveDamage, getHitLocation, HIT_LOCATION_LABELS } from "./damage-resolution.mjs";
import { getArmorCoveringLocation } from "./armor.mjs";
import { rollPainResistanceForInjury } from "../rolls/injury-roll.mjs";

// Górne granice włącznie, ostatni wiersz bez górnej granicy. B&W s.146–149.
const profiles = {
  MELEE_1: [[10,"sD/sD/sD"],[12,"sD/sD/sL"],[14,"sD/sL/sL"],[16,"sD/sL/sC"],[18,"sL/sL/sC"],[Infinity,"sL/sC/sC"]],
  MELEE_2: [[10,"D/L/L"],[14,"L/L/C"],[18,"L/C/C"],[Infinity,"L/C/K"]],
  MELEE_3: [[10,"D/L/L"],[14,"L/L/C"],[Infinity,"L/C/C"]],
  MELEE_5: [[10,"sD/sL/sL"],[14,"sL/sL/sC"],[Infinity,"sL/sC/sC"]],
  MELEE_6: [[10,"D/L/L"],[14,"L/L/C"],[18,"L/C/C"],[Infinity,"L/C/K"]],
  MELEE_7: [[Infinity,"L/C/K"]], MELEE_8: [[Infinity,"L/C/K"]],
  MELEE_9: [[Infinity,"D/L/L"]], MELEE_10: [[Infinity,"L/C/K"]],
  MELEE_11: [[10,"L/L/C"],[14,"L/C/C"],[18,"L/C/C"],[Infinity,"L/C/K"]],
  MELEE_12: [[10,"D/L/C"],[14,"D/C/K"],[18,"L/C/K"],[Infinity,"C/C/K"]],
  MELEE_13: [[Infinity,"L/C/C"]], MELEE_14: [[Infinity,"L/C/C"]],
  MELEE_15: [[Infinity,"sD/sL/sL"]], MELEE_16: [[Infinity,"D/L/L"]],
  MELEE_17: [[Infinity,"sD/sL/sC"]]
};
export function normalizeMeleeDamageCode(value) {
  const text = String(value ?? "").trim();
  if (/^D_s[DLCK]$/.test(text)) return `S_${text.at(-1)}`;
  if (/^s[DLCK]$/.test(text)) return `S_${text.at(-1)}`;
  if (/^[DLCK]$/.test(text)) return `D_${text}`;
  return /^[DS]_[DLCK]$/.test(text) ? text : null;
}
export function meleeDamageProfile(weapon, build, successes) {
  if (!Number.isFinite(build) || ![1,2,3].includes(successes)) throw new Error("Nieprawidłowa Budowa lub liczba sukcesów ciosu.");
  const sourceCode = weapon ? weapon.system.sourceCode : "MELEE_1";
  const rows = Object.entries(weapon?.system.damageByBuild ?? {}).filter(([,value]) => String(value).trim())
    .map(([key,value]) => [key === "below19" ? Infinity : Number(key.replace("below", "")), value])
    .filter(([limit]) => !Number.isNaN(limit)).sort((a,b) => a[0]-b[0]);
  const custom = rows.find(([limit]) => build <= limit)?.[1];
  const parsed = custom?.split("/").map(normalizeMeleeDamageCode);
  const valid = parsed?.length === 3 && parsed.every(Boolean);
  const raw = valid ? custom : profiles[sourceCode]?.find(([limit]) => build <= limit)?.[1];
  const codes = raw?.split("/").map(normalizeMeleeDamageCode);
  return { damageCode: codes?.[successes-1] ?? null, profile: raw ?? "brak profilu",
    source: valid ? "karta broni" : raw ? "podręcznik, s.146–149" : "do wskazania przez MG" };
}

export function createMeleeDamageHits(state, exchange, configurations, actors) {
  const attacks = exchange.hit ? [[exchange.attackerId, exchange.defenderId, exchange.attackSuccesses, exchange.attackDice]] : [];
  if (exchange.counterHit) attacks.push([exchange.defenderId, exchange.attackerId, exchange.counterHitSuccesses, exchange.defenseDice]);
  return attacks.map(([sourceId,targetId,successes,indices]) => {
    const source = actors.find(actor => actor.id === sourceId);
    const configuration = configurations.find(entry => entry.id === sourceId);
    const weapon = configuration.weaponId ? source.items.get(configuration.weaponId) : null;
    const fighter = state.fighters.find(entry => entry.id === sourceId);
    const threshold = sourceId === exchange.attackerId ? exchange.attackThreshold : exchange.defenseThreshold;
    const die = indices.map(index => fighter.dice[index]).find(die => die.natural !== 20 && die.value <= threshold);
    const build = calculateAttributeValue(source, "budowa");
    const code = weapon?.system.sourceCode ?? "MELEE_1";
    return { id: globalThis.foundry?.utils?.randomID?.() ?? crypto.randomUUID().replaceAll("-", "").slice(0,16), sourceId, targetId,
      sourceName: source.name, weaponName: weapon?.name ?? "Pięści", successes, build,
      ...meleeDamageProfile(weapon, build, successes), naturalResult: die?.natural,
      damageType: ["MELEE_3","MELEE_7","MELEE_8","MELEE_10","MELEE_13","MELEE_14"].includes(code) ? "cutting" : profiles[code] ? "blunt" : "",
      armorPenetration: weapon?.system.armorPenetration ?? 0, completed: false };
  });
}
const input = (title,content,label) => foundry.applications.api.DialogV2.input({
  window: { title }, content, ok: { label }, rejectClose: false, modal: true
});

// Każdy etap zapisujemy przed mutacją dokumentów. Id rany oraz znacznik
// na pancerzu pozwalają wznowić zapis po przerwaniu bez podwójnych obrażeń.
export async function resolveMeleeDamageHit(hit, actor, persist) {
  if (hit.completed) return true;
  const save = async changes => { hit = { ...hit, ...changes }; await persist(hit); };
  if (!hit.spec) {
    const codes = ["D_D","D_L","D_C","D_K","S_D","S_L","S_C","S_K"];
    const form = await input(`Obrażenia — ${actor.name}`, `<p>${escape(hit.sourceName)}: ${escape(hit.weaponName)}, Budowa ${hit.build}, cios za ${hit.successes} sukcesy.</p>
      <p>Profil: ${escape(hit.profile)} (${escape(hit.source)}).</p>
      <label>Obrażenia<select name="damageCode"><option value="">Wybierz obrażenia</option>${codes.map(code=>`<option value="${code}" ${code===hit.damageCode?"selected":""}>${code.replace("D_", "Rana ").replace("S_", "Siniaki ")}</option>`).join("")}</select></label>
      <label>Naturalna kość lokacji (1–19)<input name="naturalResult" type="number" min="1" max="19" step="1" value="${hit.naturalResult ?? ""}"></label>
      <p>Tabela jak przy strzelaniu. Domyślnie pierwsza udana kość ciosu, przed poprawkami Umiejętności; przy ciosie łączonym MG może wskazać inną.</p>
      <label>Rodzaj obrażeń<select name="damageType"><option value="">Wybierz rodzaj</option><option value="blunt" ${hit.damageType==="blunt"?"selected":""}>Obuchowe</option><option value="cutting" ${hit.damageType==="cutting"?"selected":""}>Tnące / kłute</option></select></label>
      <label>Przebicie pancerza<input name="armorPenetration" type="number" min="0" step="1" value="${hit.armorPenetration}"></label>`, "Rozlicz trafienie");
    if (!form) return false;
    const naturalResult = Number(form.naturalResult), armorPenetration = Number(form.armorPenetration);
    if (!codes.includes(form.damageCode) || !Number.isInteger(naturalResult) || naturalResult<1 || naturalResult>19
      || !["blunt","cutting"].includes(form.damageType) || !Number.isInteger(armorPenetration) || armorPenetration<0) throw new Error("Sprawdź obrażenia, kość lokacji, rodzaj ciosu i przebicie pancerza.");
    await save({ spec: { damageCode: form.damageCode, naturalResult, armorPenetration, damageType: form.damageType } });
  }
  if (!hit.result) {
    const location = getHitLocation(hit.spec.naturalResult);
    const candidates = getArmorCoveringLocation(actor, location, hit.spec.damageType);
    let selected = candidates[0], armor = null;
    if (candidates.length>1) {
      const form = await input(`Pancerz — ${HIT_LOCATION_LABELS[location]}`, `<select name="armorId">${candidates.map(({item,reduction})=>`<option value="${item.id}">${escape(item.name)} — redukcja ${reduction}</option>`).join("")}</select>`, "Wybierz pancerz");
      if (!form) return false;
      selected = candidates.find(entry=>entry.item.id===form.armorId);
      if (!selected) throw new Error("Wybierz pancerz przyjmujący trafienie.");
    }
    if (selected) {
      const coverageRoll = selected.coverageChance<100 ? (await new foundry.dice.Roll("1d20").evaluate()).total : null;
      armor = { id: selected.item.id, name: selected.item.name, coverageRoll,
        covered: coverageRoll===null || coverageRoll<=Math.floor(selected.coverageChance/5), reduction: selected.reduction };
    }
    await save({ armor, result: resolveDamage({ ...hit.spec, armorReduction: armor?.covered ? armor.reduction : 0 }) });
  }
  if (!hit.result.prevented && !hit.injury) {
    let injury;
    if (hit.result.damageKind === "S") {
      // Pole poza etykietą: style etykiet DialogV2 nie mogą blokować
      // kliknięcia ani ograniczać miejsca na edytowalną kontrolkę.
      const form = await input(`Siniaki — ${actor.name}`, `
        <p>${hit.result.locationLabel}: ${hit.result.finalDamageName}. Końcowy kod: ${hit.result.finalDamageCode}.</p>
        <div class="form-group stacked">
          <label for="neuroshima-bruise-penalty">Końcowa kara za siniaki (%) — ustala MG</label>
          <div class="form-fields">
            <input id="neuroshima-bruise-penalty" name="penaltyPercent" type="number"
              min="0" step="1" placeholder="Wpisz karę, np. 15" required autofocus
              style="width: 100%; min-width: 120px; pointer-events: auto;">
          </div>
        </div>`, "Zapisz siniaki");
      if (!form) return false;
      const penaltyPercent = Number(form.penaltyPercent);
      if (form.penaltyPercent == null || String(form.penaltyPercent).trim()==="" || !Number.isInteger(penaltyPercent) || penaltyPercent<0) throw new Error("Wpisz końcową karę za siniaki.");
      injury = { injuryType: "bruise", penaltyPercent };
    } else {
      injury = await rollPainResistanceForInjury(actor, hit.result.injuryType);
      if (!injury) return false;
    }
    await save({ injury });
  }
  // Sprawdź również aktualność pojedynku/Trackera przed zapisem dokumentów.
  await persist(hit);
  if (!hit.result.prevented && !actor.items.get(hit.id)) {
    await actor.createEmbeddedDocuments("Item", [{ _id: hit.id, name: `${hit.result.finalDamageName} — ${hit.result.locationLabel}`,
      type: "injury", system: { injuryType: hit.injury.injuryType, penaltyPercent: hit.injury.penaltyPercent,
        location: hit.result.location, description: `Walka wręcz: ${hit.sourceName}, ${hit.weaponName}, ${hit.successes} sukcesy. ${hit.result.finalDamageCode}. ${hit.result.locationDescription}` },
      flags: { neuroshima: { meleeDamageId: hit.id, damageCode: hit.result.finalDamageCode } } }], { keepId: true });
  }
  if (hit.armor?.covered && hit.result.armorDurabilityLoss>0) {
    const armor = actor.items.get(hit.armor.id);
    if (!armor) throw new Error("Brakuje pancerza przyjmującego trafienie. Przywróć go, aby dokończyć zapis.");
    if (!armor.getFlag("neuroshima", "meleeDamageApplied")?.[hit.id]) {
      const remaining = Math.max(0, armor.system[hit.result.location].currentDurability-hit.result.armorDurabilityLoss);
      await armor.update({ [`system.${hit.result.location}.currentDurability`]: remaining,
        [`flags.neuroshima.meleeDamageApplied.${hit.id}`]: true });
    }
  }
  await save({ completed: true });
  await foundry.documents.ChatMessage.create({ speaker: foundry.documents.ChatMessage.getSpeaker({actor}), content:
    `<p>Walka wręcz: ${escape(actor.name)} — ${hit.result.locationLabel}. ${hit.result.prevented ? "Pancerz zatrzymał cios." : `${hit.result.finalDamageName}; kara ${hit.injury.penaltyPercent}%. Zapisano na karcie.`}</p>${hit.armor ? `<p>Pancerz: ${escape(hit.armor.name)}, ${hit.armor.covered ? "osłonił lokację" : "trafienie poza osłoną"}${hit.armor.coverageRoll===null?"":`; rzut osłony ${hit.armor.coverageRoll}`}.</p>` : ""}` });
  return true;
}
