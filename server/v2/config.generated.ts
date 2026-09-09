// AUTOMATIKUSAN GENERÁLT — NE SZERKESZD.
// Forrás: ingestion/synonyms.yaml + ingestion/documents.yaml
// Újragenerálás: node ingestion/gen-config.mjs
export interface SynonymGroup { id: string; terms: string[]; }
export interface DocRule { match: string; topics: string[]; }

export const synonymGroups: SynonymGroup[] = [
  {
    "id": "nyiras",
    "terms": [
      "nyírás",
      "nyíró",
      "nyírt",
      "nyírási",
      "nyíróerő",
      "nyírófeszültség",
      "nyírt kapcsolat",
      "V_Ed",
      "V_Rd"
    ]
  },
  {
    "id": "kihajlas",
    "terms": [
      "kihajlás",
      "kihajlási",
      "karcsúság",
      "karcsúsági",
      "stabilitás",
      "stabilitásvesztés",
      "kifordulás"
    ]
  },
  {
    "id": "keresztmetszet_osztaly",
    "terms": [
      "keresztmetszet",
      "keresztmetszeti osztály",
      "osztályozás",
      "osztályba sorolás",
      "alkotólemez"
    ]
  },
  {
    "id": "csavaras",
    "terms": [
      "csavarás",
      "csavaró",
      "csavarási",
      "T_Ed"
    ]
  },
  {
    "id": "atszurodas",
    "terms": [
      "átszúródás",
      "átszúródási",
      "átlyukadás"
    ]
  },
  {
    "id": "fáradás",
    "terms": [
      "fáradás",
      "fáradási",
      "kifáradás",
      "feszültségtartomány",
      "terhelési ciklus"
    ]
  },
  {
    "id": "szelteher",
    "terms": [
      "szélteher",
      "szélterhelés",
      "szélhatás",
      "szélnyomás",
      "szélsebesség",
      "torlónyomás"
    ]
  },
  {
    "id": "hoteher",
    "terms": [
      "hóteher",
      "hóterhelés",
      "hó",
      "hófelhalmozódás"
    ]
  },
  {
    "id": "homerseklet",
    "terms": [
      "hőmérséklet",
      "hőmérsékleti hatás",
      "hőtágulás",
      "hőhatás"
    ]
  },
  {
    "id": "onsuly_hasznos",
    "terms": [
      "önsúly",
      "önsúlyteher",
      "hasznos teher",
      "hasznos terhelés",
      "felhasználási teher"
    ]
  },
  {
    "id": "tuz",
    "terms": [
      "tűz",
      "tűzállóság",
      "tűzhatás",
      "tűzvédelem",
      "tűzteher",
      "kritikus hőmérséklet"
    ]
  },
  {
    "id": "foldrenges",
    "terms": [
      "földrengés",
      "földrengési",
      "szeizmikus",
      "rengés",
      "viselkedési tényező"
    ]
  },
  {
    "id": "vasalas",
    "terms": [
      "vasalás",
      "betonacél",
      "kengyel",
      "kengyeles",
      "hosszvasalás",
      "nyírási vasalás",
      "vasmennyiség"
    ]
  },
  {
    "id": "teherbiras",
    "terms": [
      "teherbírás",
      "ellenállás",
      "tervezési érték",
      "határállapot",
      "teherbírási határállapot"
    ]
  },
  {
    "id": "hasznalhatosag",
    "terms": [
      "használhatóság",
      "használhatósági határállapot",
      "alakváltozás",
      "lehajlás",
      "repedéstágasság"
    ]
  },
  {
    "id": "talaj",
    "terms": [
      "talajvizsgálat",
      "talajmechanika",
      "geotechnika",
      "cölöp",
      "alapozás",
      "talajszilárdság",
      "nyomószondázás"
    ]
  },
  {
    "id": "alapelvek",
    "terms": [
      "megbízhatóság",
      "tervezési élettartam",
      "biztonsági tényező",
      "parciális tényező",
      "tervezési alapelv"
    ]
  },
  {
    "id": "oszver",
    "terms": [
      "öszvér",
      "öszvérszerkezet",
      "öszvértartó",
      "nyírt kapcsolóelem",
      "fejescsap"
    ]
  },
  {
    "id": "falazat",
    "terms": [
      "falazat",
      "falazóelem",
      "falazóhabarcs",
      "teherhordó fal"
    ]
  },
  {
    "id": "fa",
    "terms": [
      "fa",
      "faszerkezet",
      "faanyag",
      "rétegelt-ragasztott",
      "tömörfa"
    ]
  }
];

export const docRules: DocRule[] = [
  {
    "match": "1990",
    "topics": [
      "tervezési alapelv",
      "megbízhatóság",
      "határállapot",
      "tervezési élettartam",
      "biztonsági tényező"
    ]
  },
  {
    "match": "1991-1-1",
    "topics": [
      "önsúly",
      "hasznos teher",
      "térfogatsűrűség"
    ]
  },
  {
    "match": "1991-1-2",
    "topics": [
      "tűz",
      "tűzteher",
      "tűzhatás"
    ]
  },
  {
    "match": "1991-1-3",
    "topics": [
      "hó",
      "hóteher",
      "hóterhelés"
    ]
  },
  {
    "match": "1991-1-4",
    "topics": [
      "szél",
      "szélteher",
      "szélhatás",
      "szélnyomás"
    ]
  },
  {
    "match": "1991-1-5",
    "topics": [
      "hőmérséklet",
      "hőmérsékleti hatás",
      "hőtágulás"
    ]
  },
  {
    "match": "1991-1-6",
    "topics": [
      "kivitelezés",
      "építés közbeni teher"
    ]
  },
  {
    "match": "1991-1-7",
    "topics": [
      "rendkívüli teher",
      "ütközés",
      "robbanás"
    ]
  },
  {
    "match": "1991-2",
    "topics": [
      "híd",
      "hídteher",
      "forgalmi teher",
      "közúti híd"
    ]
  },
  {
    "match": "1992",
    "topics": [
      "vasbeton",
      "beton",
      "betonszerkezet",
      "feszített beton"
    ]
  },
  {
    "match": "1993",
    "topics": [
      "acél",
      "acélszerkezet",
      "acélszerkezetek"
    ]
  },
  {
    "match": "1994",
    "topics": [
      "öszvér",
      "öszvérszerkezet",
      "öszvértartó",
      "öszvéroszlop"
    ]
  },
  {
    "match": "1995",
    "topics": [
      "fa",
      "faszerkezet",
      "faanyag"
    ]
  },
  {
    "match": "1996",
    "topics": [
      "falazat",
      "falazott",
      "teherhordó fal"
    ]
  },
  {
    "match": "1997",
    "topics": [
      "geotechnika",
      "talaj",
      "alapozás",
      "cölöp",
      "talajvizsgálat"
    ]
  },
  {
    "match": "1998",
    "topics": [
      "földrengés",
      "szeizmikus",
      "rengés",
      "földrengési"
    ]
  }
];
