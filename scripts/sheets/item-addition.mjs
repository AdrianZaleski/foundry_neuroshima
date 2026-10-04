import { preventDuplicateFeature } from "../effects/feature-duplicates.mjs";
import { confirmPerkAddition } from "./feature-requirements.mjs";

const names = {
  armor: "Nowy pancerz", disease: "Nowa choroba", medicine: "Nowy lek",
  equipment: "Nowy przedmiot", weapon: "Nowa broń", meleeWeapon: "Nowa broń ręczna",
  ammunition: "Nowa amunicja", perk: "Nowa sztuczka", trait: "Nowa cecha", injury: "Nowa rana"
};

// Copy content, never the catalogue document's identity, ownership or folder.
export function itemAdditionData(document) {
  const source = document.toObject ? document.toObject() : document;
  return foundry.utils.deepClone(Object.fromEntries(
    ["name", "type", "img", "system", "effects", "flags"]
      .filter(key => source[key] !== undefined).map(key => [key, source[key]])
  ));
}

export async function getAdditionCatalog(type) {
  const packs = [...game.packs.values()].filter(pack => pack.documentName === "Item" && pack.visible);
  const results = await Promise.allSettled(packs.map(async pack => {
    const index = await pack.getIndex({ fields: ["type"] });
    return {
      pack,
      entries: [...index.values()].filter(entry => entry.type === type)
        .sort((a, b) => a.name.localeCompare(b.name, "pl"))
    };
  }));
  if (results.some(result => result.status === "rejected")) {
    ui.notifications.warn("Nie udało się odczytać części kompendiów. Lista może być niepełna.");
  }
  return results.filter(result => result.status === "fulfilled" && result.value.entries.length)
    .map(result => result.value);
}

export function createAdditionSheetClass(BaseSheet) {
  return class NeuroshimaItemAdditionSheet extends BaseSheet {
    static DEFAULT_OPTIONS = {
      classes: ["neuroshima-item-addition"],
      canCreate: false,
      canImport: false,
      sheetConfig: false,
      ownershipConfig: false,
      window: { resizable: true },
      actions: {
        confirmAddition: function () { return this.confirmAddition(); },
        cancelAddition: function () { return this.close(); }
      }
    };

    static PARTS = {
      ...BaseSheet.PARTS,
      main: { ...BaseSheet.PARTS.main, scrollable: [""] },
      addition: { template: "systems/neuroshima/templates/item/addition-footer.hbs" }
    };

    get title() { return `Dodawanie — ${this.item.name}`; }

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      context.additionSource = this.additionSource;
      return context;
    }

    // A change or Enter only updates the draft. The explicit button is the
    // sole persistence path, including for an Item with an Actor parent.
    async _processSubmitData(event, form, data) {
      this.item.updateSource(data);
      return {};
    }

    async confirmAddition() {
      if (this.additionPending || this.additionComplete || this.additionClosed || !this.item.parent.isOwner) return;
      if (!this.form.reportValidity()) return;
      this.additionPending = true;
      try {
        // Flush even a still-focused input before copying the draft.
        await this.submit();
        const data = itemAdditionData(this.item);
        data.name = String(data.name ?? "").trim();
        if (!data.name) {
          ui.notifications.warn("Uzupełnij nazwę przed dodaniem do postaci.");
          return;
        }
        const actor = this.item.parent;
        if (preventDuplicateFeature(actor, data)) return;
        if (!(await confirmPerkAddition(actor, data))) return;
        if (!actor.isOwner || this.additionClosed) return;
        const [created] = await actor.createEmbeddedDocuments("Item", [data]);
        if (!created) throw new Error("Pozycja nie została zapisana.");
        this.additionComplete = true;
        await this.close();
        return created;
      } catch (error) {
        console.error("Neuroshima | Dodawanie do postaci", error);
        ui.notifications.error(`Nie udało się dodać pozycji: ${error.message}`);
      } finally {
        this.additionPending = false;
      }
    }

    async close(options) {
      this.additionClosed = true;
      return super.close(options);
    }
  };
}

export async function openItemAddition(actor, type, { system = {} } = {}) {
  if (!actor.isOwner || !Object.hasOwn(names, type)) return null;
  let data = { name: names[type], type, system };
  let sourceLabel = "Własna pozycja";
  const catalog = type === "injury" ? [] : await getAdditionCatalog(type);
  if (catalog.length) {
    const escape = foundry.utils.escapeHTML;
    const choices = [];
    const groups = catalog.map(({ pack, entries }) => {
      const options = entries.map(entry => {
        const value = choices.push({ pack, id: entry._id }) - 1;
        return `<option value="${value}">${escape(entry.name)}</option>`;
      }).join("");
      return `<optgroup label="${escape(pack.metadata.label)}">${options}</optgroup>`;
    }).join("");
    const answer = await foundry.applications.api.DialogV2.input({
      window: { title: `Dodawanie — ${names[type]}` },
      position: { width: 560 },
      content: `<p>Wybierz pozycję z kompendium albo utwórz własną.</p>
        <div class="form-group"><label for="ns-addition-choice">Pozycja</label>
        <select id="ns-addition-choice" name="choice"><option value="custom">＋ Własna pozycja</option>${groups}</select></div>
        <p>W następnym oknie zobaczysz opis i statystyki oraz dostosujesz parametry. Zapis nastąpi dopiero po kliknięciu „Dodaj do postaci”.</p>`,
      ok: { label: "Dalej — podgląd i parametry", icon: "fa-solid fa-arrow-right" },
      modal: true,
      rejectClose: false
    });
    if (!answer) return null;
    if (answer.choice !== "custom") {
      const choice = choices[Number(answer.choice)];
      if (!choice) return null;
      try {
        const source = await choice.pack.getDocument(choice.id);
        if (!source || source.type !== type) throw new Error("Wpis jest niedostępny.");
        data = itemAdditionData(source);
        sourceLabel = `${choice.pack.metadata.label} — ${source.name}`;
      } catch (error) {
        ui.notifications.error(`Nie udało się otworzyć wpisu z kompendium: ${error.message}`);
        return null;
      }
    }
  }

  // No create(), temporary database document, or change to the Actor yet.
  const draft = new CONFIG.Item.documentClass({ ...data, _id: foundry.utils.randomID() }, { parent: actor });
  const Sheet = createAdditionSheetClass(draft.sheet.constructor);
  const sheet = new Sheet({ document: draft });
  sheet.additionSource = sourceLabel;
  // Existing sheet actions (e.g. disease modifiers) also write only locally.
  draft.update = async changes => {
    draft.updateSource(changes);
    await sheet.render({ force: true });
    return draft;
  };
  await sheet.render({ force: true });
  return sheet;
}
