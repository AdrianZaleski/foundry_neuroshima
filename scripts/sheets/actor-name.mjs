// Ksywa na karcie ma być spójna z podpisem tokenu i wzorcem nowych tokenów.
// Karta otwarta z niepowiązanego tokenu ma osobnego Actora syntetycznego.
// Zapis ksywki obejmuje także jego wzorzec, ale nie kopiuje innych danych.
export async function saveActorNickname(actor, value) {
  const name = String(value ?? "").trim();
  if (!name) throw new Error("Ksywa postaci nie może być pusta.");
  const sourceActor = actor.isToken ? game.actors.get(actor.token?.actorId ?? actor.id) : actor;
  if (!sourceActor) throw new Error("Nie znaleziono źródłowej postaci na liście Actorów.");
  await sourceActor.update({ name, "prototypeToken.name": name });
  if (actor.isToken) await actor.update({ name });
  for (const scene of game.scenes) {
    const tokens = [...scene.tokens].filter(token => token.actorId === sourceActor.id);
    // Podpis tokenu i nazwa na jego karcie to dwa różne pola. Stara
    // lokalna nazwa Actora potrafi przesłonić poprawioną nazwę wzorca.
    for (const token of tokens) {
      if (token.actor?.isToken && token.actor.name !== name) await token.actor.update({ name });
    }
    const updates = tokens.filter(token => token.name !== name).map(token => ({ _id: token.id, name }));
    if (updates.length) await scene.updateEmbeddedDocuments("Token", updates);
  }
  // Combatant może mieć jawnie zapisaną nazwę, niezależną od nazwy tokenu.
  for (const combat of game.combats) {
    const updates = [...combat.combatants].filter(participant =>
      (participant.actorId ?? participant.actor?.id) === sourceActor.id)
      .filter(participant => participant.name !== name)
      .map(participant => ({ _id: participant.id, name }));
    if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates);
  }
  return name;
}
