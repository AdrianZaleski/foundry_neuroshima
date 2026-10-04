export function setupItemAddition() {
  const saved = [], dialogs = [], warnings = [], errors = [], drafts = [];
  let sequence = 0;
  class Sheet {
    static PARTS = { main: { template: "item.hbs" } };
    constructor({ document }) {
      this.item = document;
      this.form = { reportValidity: () => true };
      this.formData = {};
    }
    async _prepareContext() { return {}; }
    async render() { this.rendered = true; return this; }
    async close() { this.rendered = false; }
    async submit() { return this._processSubmitData(null, this.form, this.formData); }
  }
  class Item {
    constructor(data, { parent }) {
      this.data = structuredClone({ system: {}, ...data });
      this.parent = parent;
      this.sheet = new Sheet({ document: this });
      drafts.push(this);
    }
    get name() { return this.data.name; }
    get type() { return this.data.type; }
    get system() { return this.data.system; }
    toObject() { return structuredClone(this.data); }
    updateSource(changes) {
      for (const [key, value] of Object.entries(changes)) {
        const parts = key.split(".");
        const leaf = parts.pop();
        const target = parts.reduce((object, part) => object[part] ??= {}, this.data);
        target[leaf] = structuredClone(value);
      }
    }
  }
  globalThis.foundry = {
    utils: {
      deepClone: structuredClone, randomID: () => `draft${++sequence}`,
      escapeHTML: value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;")
    },
    documents: { Combat: class {} },
    applications: {
      sheets: { ActorSheetV2: class {} },
      api: { HandlebarsApplicationMixin: Base => Base, DialogV2: {
        input: async options => { dialogs.push(options); return { choice: "custom" }; },
        confirm: async options => { dialogs.push(options); return true; }
      } }
    }
  };
  globalThis.CONFIG = { Item: { documentClass: Item } };
  globalThis.game = { packs: new Map() };
  globalThis.ui = { notifications: { warn: text => warnings.push(text), error: text => errors.push(text) } };
  const actor = {
    name: "Postać", isOwner: true, items: [], system: { attributes: {}, skills: {}, background: {}, activeModifiers: [] },
    async createEmbeddedDocuments(type, data) {
      saved.push(...structuredClone(data));
      return data.map(item => ({ ...item, id: `saved${saved.length}` }));
    }
  };
  function addPack(documents, { visible = true, documentName = "Item", label = "Katalog <test>" } = {}) {
    const pack = {
      visible, documentName, metadata: { label },
      getIndex: async () => new Map(documents.map(item => [item._id, item])),
      getDocument: async id => documents.find(item => item._id === id)
    };
    game.packs.set(`pack${game.packs.size}`, pack);
    return pack;
  }
  return { actor, saved, dialogs, warnings, errors, drafts, addPack };
}
