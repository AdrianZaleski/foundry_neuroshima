import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("karta postaci ma wspólny nagłówek i przewijane zakładki nowego layoutu", async () => {
  const [sheet, header, css, ...tabs] = await Promise.all([
    read("../scripts/sheets/character-sheet.mjs"),
    read("../templates/actor/parts/header.hbs"),
    read("../styles/neuroshima.css"),
    ...["main", "details", "skills", "health", "inventory"]
      .map(name => read(`../templates/actor/parts/${name}-tab.hbs`))
  ]);

  assert.match(sheet, /width:\s*900/);
  assert.match(sheet, /height:\s*760/);
  assert.ok(sheet.indexOf("parts/header.hbs") < sheet.indexOf("tab-navigation.hbs"));
  assert.match(header, /ns-character-header/);
  assert.match(header, /data-actor-name/);
  assert.match(header, /data-action="saveActorName"/);
  assert.match(css, /\.ns-character-header/);
  assert.match(css, /\.ns-sheet-tab/);
  assert.match(css, /@media \(max-width: 760px\)/);
  for (const tab of tabs) {
    assert.match(tab, /ns-sheet-tab/);
    assert.doesNotMatch(tab, /style="height: calc\(100% - 42px\)/);
  }
});
