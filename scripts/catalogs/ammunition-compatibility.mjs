// Lista pochodzi z zakładki AMMO arkusza referencyjnego.
// value jest technicznym symbolem zgodności, a label nazwą dla użytkownika.
export const ammunitionCompatibilityOptions = [
  {
    "value": "AMMO_22",
    "label": ".22 LR (Long Rifle)"
  },
  {
    "value": "AMMO_30",
    "label": ".30 Carbine"
  },
  {
    "value": "AMMO_762_3006",
    "label": ".30-06 Springfield"
  },
  {
    "value": "AMMO_300",
    "label": ".300 Winchester Magnum"
  },
  {
    "value": "AMMO_303",
    "label": ".303\""
  },
  {
    "value": "AMMO_32ACP",
    "label": ".32 ACP – Automatic Colt Pistol"
  },
  {
    "value": "AMMO_338",
    "label": ".338 Lapua Magnum"
  },
  {
    "value": "AMMO_357",
    "label": ".357 Magnum"
  },
  {
    "value": "AMMO_38",
    "label": ".38 Special"
  },
  {
    "value": "AMMO_40",
    "label": ".40 S&W"
  },
  {
    "value": "AMMO_408",
    "label": ".408 Cheyenne Tactical"
  },
  {
    "value": "AMMO_416",
    "label": ".416 Barrett"
  },
  {
    "value": "AMMO_44",
    "label": ".44 Magnum"
  },
  {
    "value": "AMMO_4440",
    "label": ".44-40 WCF"
  },
  {
    "value": "AMMO_45ACP",
    "label": ".45\" ACP"
  },
  {
    "value": "AMMO_50AE",
    "label": ".50 Action Express (AE)"
  },
  {
    "value": "AMMO_50BMG",
    "label": ".50\" BMG"
  },
  {
    "value": "AMMO_50_MAGNUM",
    "label": ".500 A-square"
  },
  {
    "value": "AMMO_SH_12",
    "label": "12 gauge"
  },
  {
    "value": "AMMO_SH_12_MAUL",
    "label": "12 Gauge Metalstorm"
  },
  {
    "value": "AMMO_127WYCHLOP",
    "label": "12.7×55mm STs-130"
  },
  {
    "value": "AMMO_20MM",
    "label": "20x102mm"
  },
  {
    "value": "AMMO_47",
    "label": "4,7 mm"
  },
  {
    "value": "AMMO_46",
    "label": "4.6x30mm"
  },
  {
    "value": "AMMO_GL_40",
    "label": "40mm"
  },
  {
    "value": "AMMO_545",
    "label": "5,45 x 39mm"
  },
  {
    "value": "AMMO_556",
    "label": "5,56mm"
  },
  {
    "value": "AMMO_57",
    "label": "5.7x28mm"
  },
  {
    "value": "AMMO_762TT",
    "label": "7.62×25mm"
  },
  {
    "value": "AMMO_762AK",
    "label": "7.62×39mm"
  },
  {
    "value": "AMMO_762NT",
    "label": "7.62×51mm NATO"
  },
  {
    "value": "AMMO_939",
    "label": "9 x 39mm"
  },
  {
    "value": "AMMO_9",
    "label": "9×19mm Luger"
  },
  {
    "value": "AMMMO_BOLT",
    "label": "Bełt"
  },
  {
    "value": "AMMO_BUMERANG",
    "label": "Bumerang"
  },
  {
    "value": "AMMO_GL_25",
    "label": "Granat 25mm"
  },
  {
    "value": "AMMO_GL_40_RU",
    "label": "Granat 40mm VOG"
  },
  {
    "value": "AMMO_THROWN",
    "label": "Kamień"
  },
  {
    "value": "AMMO_BLACKPOWDER",
    "label": "Kula do czarnoprochowca"
  },
  {
    "value": "AMMO_ARROW",
    "label": "Strzała"
  }
];

export const ammunitionNamesBySymbol = Object.fromEntries(
  ammunitionCompatibilityOptions.map((option) => [option.value, option.label])
);

