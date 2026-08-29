export class NeuroshimaCharacterDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { NumberField, SchemaField, StringField } = foundry.data.fields;

    // Każdy z pięciu współczynników ma identyczną strukturę danych.
    // Funkcja pomocnicza chroni nas przed pięciokrotnym powtarzaniem definicji.
    const createAttributeSchema = () => new SchemaField({
      // "base" jest wartością wpisywaną przez użytkownika i zapisywaną w bazie świata.
      base: new NumberField({ required: true, nullable: false, integer: true, min: 1, max: 40, initial: 1 }),

      // "modifier" i "value" są wyliczane przy każdym przygotowaniu danych.
      // persisted: false oznacza, że Foundry nie zapisuje ich w bazie świata.
      modifier: new NumberField({ required: true, nullable: false, integer: true, initial: 0, persisted: false }),
      value: new NumberField({ required: true, nullable: false, integer: true, initial: 1, persisted: false })
    });

    // Umiejętności korzystają z podobnej struktury jak współczynniki,
    // ale ich dozwolony poziom mieści się w zakresie od 0 do 20.
    const createSkillSchema = () => new SchemaField({
      base: new NumberField({ required: true, nullable: false, integer: true, min: 0, max: 20, initial: 0 }),
      modifier: new NumberField({ required: true, nullable: false, integer: true, initial: 0, persisted: false }),
      value: new NumberField({ required: true, nullable: false, integer: true, initial: 0, persisted: false })
    });

    // Wiedza ogólna działa jak zwykła umiejętność, ale użytkownik sam wpisuje jej nazwę.
    // Wszystkie takie pola pozostają na stałe przypisane do Sprytu.
    const createGeneralKnowledgeSchema = () => new SchemaField({
      name: new StringField({ required: true, nullable: false, initial: "" }),
      base: new NumberField({ required: true, nullable: false, integer: true, min: 0, max: 20, initial: 0 }),
      modifier: new NumberField({ required: true, nullable: false, integer: true, initial: 0, persisted: false }),
      value: new NumberField({ required: true, nullable: false, integer: true, initial: 0, persisted: false })
    });

    return {
      attributes: new SchemaField({
        zrecznosc: createAttributeSchema(),
        percepcja: createAttributeSchema(),
        charakter: createAttributeSchema(),
        spryt: createAttributeSchema(),
        budowa: createAttributeSchema()
      }),

      // Zaczynamy od jednej niewielkiej grupy umiejętności przypisanych do Zręczności.
      // Kolejne grupy dodamy po sprawdzeniu tego modelu w działającym świecie.
      skills: new SchemaField({
        bijatyka: createSkillSchema(),
        bronReczna: createSkillSchema(),
        rzucanie: createSkillSchema(),
        pistolety: createSkillSchema(),
        karabiny: createSkillSchema(),
        bronMaszynowa: createSkillSchema(),
        luk: createSkillSchema(),
        kusza: createSkillSchema(),
        proca: createSkillSchema(),
        samochod: createSkillSchema(),
        ciezarowka: createSkillSchema(),
        motocykl: createSkillSchema(),
        kradziezKieszonkowa: createSkillSchema(),
        zwinneDlonie: createSkillSchema(),
        otwieranieZamkow: createSkillSchema(),
        wyczucieKierunku: createSkillSchema(),
        tropienie: createSkillSchema(),
        przygotowaniePulapki: createSkillSchema(),
        nasluchiwanie: createSkillSchema(),
        wypatrywanie: createSkillSchema(),
        czujnosc: createSkillSchema(),
        skradanieSie: createSkillSchema(),
        ukrywanieSie: createSkillSchema(),
        maskowanie: createSkillSchema(),
        lowiectwo: createSkillSchema(),
        zdobywanieWody: createSkillSchema(),
        znajomoscTerenu: createSkillSchema(),
        perswazja: createSkillSchema(),
        zastraszanie: createSkillSchema(),
        zdolnosciPrzywodcze: createSkillSchema(),
        postrzeganieEmocji: createSkillSchema(),
        blef: createSkillSchema(),
        opiekaNadZwierzetami: createSkillSchema(),
        odpornoscNaBol: createSkillSchema(),
        niezlomnosc: createSkillSchema(),
        morale: createSkillSchema(),
        leczenieRan: createSkillSchema(),
        leczenieChorob: createSkillSchema(),
        pierwszaPomoc: createSkillSchema(),
        mechanika: createSkillSchema(),
        elektronika: createSkillSchema(),
        komputery: createSkillSchema(),
        maszynyCiezkie: createSkillSchema(),
        wozyBojowe: createSkillSchema(),
        kutry: createSkillSchema(),
        rusznikarstwo: createSkillSchema(),
        wyrzutnie: createSkillSchema(),
        materialyWybuchowe: createSkillSchema(),
        wiedzaOgolna1: createGeneralKnowledgeSchema(),
        wiedzaOgolna2: createGeneralKnowledgeSchema(),
        wiedzaOgolna3: createGeneralKnowledgeSchema(),
        wiedzaOgolna4: createGeneralKnowledgeSchema(),
        wiedzaOgolna5: createGeneralKnowledgeSchema(),
        wiedzaOgolna6: createGeneralKnowledgeSchema(),
        plywanie: createSkillSchema(),
        wspinaczka: createSkillSchema(),
        kondycja: createSkillSchema(),
        jazdaKonna: createSkillSchema(),
        powozenie: createSkillSchema(),
        ujezdzanie: createSkillSchema()
      })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    // Wartość końcowa każdego współczynnika jest sumą wartości bazowej
    // oraz modyfikatora pochodzącego na przykład z efektów aktywnych.
    for (const attribute of Object.values(this.attributes)) {
      attribute.value = attribute.base + attribute.modifier;
    }

    // Wartość końcową umiejętności przygotowujemy tak samo jak współczynnik.
    // Dzięki temu przyszłe efekty będą mogły czasowo podnosić albo obniżać poziom.
    for (const skill of Object.values(this.skills)) {
      skill.value = skill.base + skill.modifier;
    }
  }
}
