const SYSTEM_ID = "neuroshima";

function serializeWeapon(item) {
  return {
    id: item.id,
    name: item.name,
    weaponClass: item.system.weaponClass,
    currentAmmunition: item.system.currentAmmunition,
    magazineCapacity: item.system.magazineCapacity,
    jamState: item.system.jamState,
    range: item.system.range,
    accuracyModifier: item.system.accuracyModifier
  };
}

function serializeCombatant(combatant) {
  return {
    id: combatant.id,
    name: combatant.name,
    actorId: combatant.actor?.id ?? null,
    tokenId: combatant.tokenId ?? combatant.token?.id ?? null,
    initiative: combatant.initiative,
    segmentAction: combatant.getFlag(SYSTEM_ID, "segmentAction") ?? null,
    combatSkillUsage: combatant.getFlag(SYSTEM_ID, "combatSkillUsage") ?? null,
    weapons: combatant.actor?.items
      .filter((item) => item.type === "weapon")
      .map(serializeWeapon) ?? []
  };
}

export function prepareCombatDiagnostics(actor) {
  const combat = game.combat;
  return {
    generatedAt: new Date().toISOString(),
    foundryVersion: game.version,
    system: {
      id: game.system.id,
      version: game.system.version
    },
    worldId: game.world?.id ?? null,
    scene: canvas.scene ? {
      id: canvas.scene.id,
      name: canvas.scene.name,
      gridDistance: canvas.scene.grid?.distance ?? null,
      gridUnits: canvas.scene.grid?.units ?? canvas.grid?.units ?? null
    } : null,
    inspectedActor: actor ? {
      id: actor.id,
      name: actor.name
    } : null,
    targets: [...game.user.targets].map((token) => ({
      id: token.id,
      name: token.name,
      actorId: token.actor?.id ?? null
    })),
    combat: combat ? {
      id: combat.id,
      started: combat.started,
      round: combat.round,
      turn: combat.turn,
      segment: combat.getFlag(SYSTEM_ID, "combatSegment") ?? null,
      activeCombatantId: combat.combatant?.id ?? null,
      combatants: combat.combatants.map(serializeCombatant)
    } : null
  };
}

export function downloadCombatDiagnostics(actor) {
  const diagnostics = prepareCombatDiagnostics(actor);
  const json = JSON.stringify(diagnostics, null, 2);
  const timestamp = diagnostics.generatedAt.replaceAll(":", "-").replaceAll(".", "-");
  foundry.utils.saveDataToFile(
    json,
    "application/json",
    `neuroshima-diagnostyka-walki-${timestamp}.json`
  );
  ui.notifications.info("Pobrano plik diagnostyczny walki.");
}
