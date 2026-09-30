import assert from "node:assert/strict";
import { test } from "node:test";
import { captureFieldState, restoreFieldState } from "../scripts/sheets/sheet-view-state.mjs";

function field(name, { nickname = false, start = null } = {}) {
  return {
    name, selectionStart: start, selectionEnd: start === null ? null : start + 3,
    selectionDirection: "backward", scrollTop: 12, scrollLeft: 4,
    hasAttribute: attr => nickname && attr === "data-actor-name",
    matches: () => true,
    focus(options) { this.focusOptions = options; },
    setSelectionRange(...range) { this.selection = range; }
  };
}

test("odświeżenie odpiętej karty zachowuje pole, zaznaczenie oraz przewinięcie notatek", () => {
  const oldField = field("system.notes.character", { start: 6 });
  const snapshot = captureFieldState({ ownerDocument: { activeElement: oldField }, contains: el => el === oldField });
  const newField = field("system.notes.character");
  const part = { querySelectorAll: () => [newField], scrollTop: 0, scrollLeft: 0 };
  restoreFieldState(part, snapshot, [["", 640, 0]]);
  assert.deepEqual(newField.focusOptions, { preventScroll: true });
  assert.deepEqual(newField.selection, [6, 9, "backward"]);
  assert.equal(newField.scrollTop, 12);
  assert.equal(part.scrollTop, 640);
});

test("pola liczbowe odzyskują focus bez niedozwolonego zaznaczania tekstu", () => {
  const oldField = field("system.skills.bijatyka.base");
  const snapshot = captureFieldState({ ownerDocument: { activeElement: oldField }, contains: () => true });
  const newField = field(oldField.name);
  restoreFieldState({ querySelectorAll: () => [newField] }, snapshot);
  assert.deepEqual(newField.focusOptions, { preventScroll: true });
  assert.equal(newField.selection, undefined);
});

test("ksywa bez atrybutu name zachowuje kursor", () => {
  const oldField = field("", { nickname: true, start: 1 });
  const snapshot = captureFieldState({ ownerDocument: { activeElement: oldField }, contains: () => true });
  const nickname = field("", { nickname: true });
  const unrelated = field("");
  restoreFieldState({ querySelectorAll: () => [unrelated, nickname] }, snapshot);
  assert.deepEqual(nickname.selection, [1, 4, "backward"]);
  assert.equal(unrelated.focusOptions, undefined);
});

test("odświeżenie nie przenosi focusu z innego okna ani do usuniętego pola", () => {
  assert.equal(captureFieldState({ ownerDocument: { activeElement: field("other") }, contains: () => false }), null);
  const part = { querySelectorAll: () => [], scrollTop: 0 };
  restoreFieldState(part, { name: "removed" }, [["", 280, 0]]);
  assert.equal(part.scrollTop, 280);
});

test("wszystkie zakładki używają natywnego zapisu przewinięcia, a okno pozwala zmienić rozmiar", async () => {
  globalThis.foundry = { documents: { Combat: class {} }, applications: {
    api: { HandlebarsApplicationMixin: Base => Base }, sheets: { ActorSheetV2: class {} }
  } };
  const { NeuroshimaCharacterSheet: Sheet } = await import("../scripts/sheets/character-sheet.mjs");
  assert.equal(Sheet.DEFAULT_OPTIONS.window.resizable, true);
  for (const tab of ["main", "details", "skills", "health", "inventory"]) {
    assert.deepEqual(Sheet.PARTS[tab].scrollable, [""]);
  }
});
