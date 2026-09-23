import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("manifest włącza kanał komunikacji systemowej gracz–MG", async () => {
  const manifestUrl = new URL("../system.json", import.meta.url);
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

  assert.equal(manifest.socket, true);
});
