# Card JSON reference

One file per card record in `cards/`, named `<card code>.json`. This guide lists every field by card type, which are
required, the allowed values, and one real example per type. The examples come from the sample packs
(`content-packs/sample-hero` and `content-packs/sample-scenario` in the game repo) and are checked by `npm run
validate`. The authoritative definitions are the TypeScript types in the game repo,
[`packages/content/src/schema/cards/`](https://github.com/quincarter/marvel-champions-digital-game/tree/main/packages/content/src/schema/cards)
(`base.ts`, `identity.ts`, `player-cards.ts`, `encounter-cards.ts`, `villain.ts`, `schemes.ts`, `attachment-host.ts`)
and [`keywords.ts`](https://github.com/quincarter/marvel-champions-digital-game/blob/main/packages/content/src/schema/keywords.ts).

Marked fields are required unless a table says "optional". A field not listed here is almost certainly not needed for
a pack card; `npm run validate` reports unknown shapes it cannot read.

## Codes and ids

| What                  | Rule                                                                                         | Example                              |
| --------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------ |
| Pack id               | lowercase letters, digits, single dashes, at most 64 characters                              | `my-hero`                            |
| Card code (`id`)      | `x.<pack-id>.<NN>` with an optional face letter `a`, `b`, `c`                                | `x.my-hero.02`, `x.my-hero.01a`      |
| Hero identity         | one record whose code ends in `a` (`01a`); the alter-ego face is part of the same record     | `x.my-hero.01a`                      |
| Double-sided cards    | one record per face where the card types differ (`02a`, `02b`), linked by `otherFaceId`      | `x.night-thrasher-dh.02a` / `02b`    |
| Ability id            | `<card code>.<slug>`: lowercase, digits and dashes in the slug; a face's ability uses its face's code | `x.my-hero.03.slam-action`, `x.my-hero.01b.quiet-study` |
| Encounter set id      | starts with the pack id; a hero's nemesis set is `<pack-id>-nemesis`                         | `my-hero-nemesis`                    |
| Deck / scenario id    | starts with `<pack-id>-`                                                                     | `my-hero-justice`                    |
| Base-game cards       | 5-digit codes (`01058`); a deck may list them, a pack card may reference them                | `01088`                              |

Rules the validator enforces: every card code starts with `x.<pack-id>.`; the part after is digits plus an optional
letter; no code is used twice; an ability id names a card number that exists in the pack; an ability id is not already
a base-game ability; the card lists each ability only once.

The card's `setCode` and `cycleId` are both the pack id. `collectorNumber` is a string (`"2"`, `"1A/1B"` for a
double-sided identity).

## Fields every card has

| Field            | Type      | Notes                                                                                    |
| ---------------- | --------- | ---------------------------------------------------------------------------------------- |
| `id`             | string    | The card code.                                                                           |
| `type`           | string    | One of `hero_identity`, `ally`, `event`, `support`, `upgrade`, `resource`, `player_side_scheme`, `villain`, `minion`, `attachment`, `main_scheme`, `side_scheme`, `treachery`, `obligation`, `environment`, `evidence`. |
| `name`           | string    | The printed title. A script that names another card must use this exact spelling.        |
| `subtitle`       | optional  | The printed subtitle.                                                                    |
| `setCode`        | string    | The pack id.                                                                             |
| `cycleId`        | string    | The pack id.                                                                             |
| `collectorNumber`| string    | Printed card number.                                                                     |
| `quantityInSet`  | number    | Copies of this card in the set, at least 1.                                              |
| `unique`         | boolean   | The unique star.                                                                         |
| `errata`, `images`, `art` | optional | Not used by packs: card pictures are files (`cards/<lang>/<code>.webp`), see README. |
| `amplifyIcons`   | optional  | A whole number: printed amplify icons.                                                   |
| `schemeIcons`    | optional  | `["crisis"]`, `["hazard"]` or `["acceleration"]` printed on a card that is not a scheme. |
| `otherFaceId`    | optional  | The other face of a double-sided card whose faces are separate records (both set).       |

### Text

```json
"text": { "printed": "Hero Action (attack): Deal 6 damage to an enemy.", "current": "Hero Action (attack): Deal 6 damage to an enemy." }
```

`printed` is what is on the card; `current` is the text with errata. For a new pack they are the same. Lines are
separated by `\n`. Write resource and aspect symbols in brackets, as the sample packs do: `[physical]`, `[mental]`,
`[energy]`, `[wild]`, `[star]`, `[per_hero]`. A card with no text has `""` for both.

### Traits and keywords

- `traits`: a list of the printed traits in upper case, as printed: `["AVENGER"]`, `["ATTACK", "SUPERPOWER"]`,
  `["S.H.I.E.L.D."]`. Empty list for none. A query in a script compares the same upper-case form.
- `keywords`: a list of keyword objects, `[]` for none. Allowed `name` values, and the extra fields each needs:

| Keyword                                                                                                              | Shape                                                                 |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `guard`, `overkill`, `peril`, `quickstrike`, `restricted`, `surge`, `toughness`, `permanent`, `piercing`, `ranged`, `setup`, `villainous`, `amplify`, `patrol`, `stalwart`, `alliance`, `steady`, `temporary`, `assault`, `vulnerable`, `starting` | `{ "name": "guard" }`                                                 |
| `retaliate`, `incite`, `victory`                                                                                     | `{ "name": "retaliate", "value": 1 }` (victory's value may be negative) |
| `hinder`                                                                                                             | `{ "name": "hinder", "value": 1, "perPlayer": 1 }` (`perPlayer` optional) |
| `uses`                                                                                                               | `{ "name": "uses", "count": 3, "counterType": "charge" }` (also `countPerPlayer`) |
| `requirement`                                                                                                        | `{ "name": "requirement", "resources": { "energy": 1 } }` or `"icon": "energy"` |
| `teamwork`                                                                                                           | `{ "name": "teamwork", "sharedTrait": "AVENGER" }`                    |
| `find`                                                                                                               | `{ "name": "find", "count": 1 }`                                      |
| `discount`                                                                                                           | `{ "name": "discount", "value": 1, "traits": ["AVENGER"] }`           |
| `teamUp`                                                                                                             | `{ "name": "teamUp", "names": ["Name A", "Name B"] }` (`names` optional) |
| `linked`                                                                                                             | `{ "name": "linked", "cardTitle": "Name", "cardType": "upgrade" }` (both optional) |
| `prerequisite`                                                                                                       | `{ "name": "prerequisite", "traits": ["AVENGER"], "form": "hero" }`   |
| `form`                                                                                                               | `{ "name": "form", "formType": "tiny" }` (lower-case)                 |

A keyword the engine does not know is a validation error, and a card that needs a new keyword needs a game update
(see [AGENTS.md](../AGENTS.md)).

### Abilities

```json
"abilities": [
  { "id": "x.my-hero.03.slam-action", "label": "Slam", "notesForScripting": "optional note for the scripter" }
]
```

Every ability the card's text needs is listed here by id. `label` and `notesForScripting` are optional. A card with
no scripted text (a vanilla ally, a minion that only has keywords) has `"abilities": []`. Each id listed must be
defined in `abilities/index.ts`; until then `npm run validate` reports it as an unscripted ability (see
[validation-errors.md](validation-errors.md)).

### Resource icons

`resourceIcons` (and a resource card's `producesIcons`) is an object with any of `physical`, `mental`, `energy`,
`wild` set to a count, `{}` for none: `{ "physical": 1 }`, `{ "wild": 1, "energy": 1 }`.

### Scaling values

Threat and hit points that scale with players are `{ "base": 0, "perPlayer": 3 }` (3 per player); a flat value is
`{ "base": 2, "perPlayer": 0 }`. There is an optional `perGroup`.

## Player cards

Shared by `ally`, `event`, `support`, `upgrade`, `resource`, `player_side_scheme`:

| Field                | Notes                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `aspect`             | `"aggression"`, `"justice"`, `"leadership"`, `"protection"`, `"basic"`, `"pool"`, or `"hero:<identity code>"` for a hero's signature cards (`"hero:x.my-hero.01a"`). |
| `traits`, `keywords`, `text`, `abilities` | As above. Required.                                                                     |
| `deckLimit`          | Copies allowed in a deck (usually the same as `quantityInSet`). A card in a separate deck has `0`.            |
| `flavor`             | Optional flavor text.                                                                                         |
| `playRestrictions`   | Optional: `maxPerPlayer`, `maxPerHost`, `form` (`"hero"`/`"alterEgo"`), `anyPlayerControl`, `maxPerRound`, `maxPerPhase`, `requiresIdentityTrait`, `requiresControlledCharacterTrait`, `maxWithTrait`. |
| `separateDeck`, `specificTo`, `printedAspect`, `flipSide`, `unitCost`, `restrictedWeight` | Optional, rare (see `player-cards.ts`).               |

Costed cards (`ally`, `event`, `support`, `upgrade`, `player_side_scheme`) also have `cost` (a number, 0 or more) and
optionally `specialCost`: `"X"`, `"dash"` (a printed dash, the card cannot be paid for) or `"star"`, and `costPerPlayer`.

### Hero identity (hero and alter ego)

One record, two faces; `hp` is shared. `hero` needs `faceName`, `traits`, `atk`, `thw`, `def`, `handSize`, `keywords`,
`text`, `abilities`. `alterEgo` needs `faceName`, `traits`, `rec`, `handSize`, `keywords`, `text`, `abilities`. Also
required: `obligationCardId` (the obligation's code) and `nemesisEncounterSetId`. Ability ids are unique across both
faces; the alter-ego face's use the `b` code (`x.my-hero.01b.quiet-study`).

```json
{
  "id": "x.sample-hero.01a", "type": "hero_identity", "name": "Sample Sentinel", "setCode": "sample-hero",
  "cycleId": "sample-hero", "collectorNumber": "1A/1B", "quantityInSet": 1, "unique": true, "hp": 10,
  "hero": {
    "faceName": "Sample Sentinel", "traits": ["SENTINEL"], "atk": 2, "thw": 1, "def": 3, "handSize": 5, "keywords": [],
    "text": { "printed": "Sentinel Sense: Interrupt: When the villain initiates an attack against you, draw 1 card.", "current": "Sentinel Sense: Interrupt: When the villain initiates an attack against you, draw 1 card." },
    "abilities": [{ "id": "x.sample-hero.01a.sentinel-sense", "label": "Sentinel Sense" }]
  },
  "alterEgo": {
    "faceName": "Sam Pell", "traits": ["TINKERER"], "rec": 3, "handSize": 6, "keywords": [],
    "text": { "printed": "Quiet Study: Resource: Generate a [physical] resource. (Limit once per round.)", "current": "Quiet Study: Resource: Generate a [physical] resource. (Limit once per round.)" },
    "abilities": [{ "id": "x.sample-hero.01b.quiet-study", "label": "Quiet Study" }]
  },
  "obligationCardId": "x.sample-hero.06",
  "nemesisEncounterSetId": "sample-hero-nemesis"
}
```

Optional on the identity: `deckbuilding` (deck-building exceptions: `aspectCount`, `offAspectAllowance`
`{ cardType, anyTrait, printedResource, maxCards }`, `maxCopiesPerTitle`, `offAspectPackages`), `separateDecks`,
`additionalHeroForms`. Each face may also have `flavor` and `schemeIcons`.

### Ally

Adds `atk`, `thw` (a number, `"X"`, or `null` for a printed dash), `hp`, `resourceIcons`, `consequentialDamage`
(`{ "attack": 0, "thwart": 1 }`: the printed consequential damage numbers).

```json
{
  "id": "x.sample-hero.02", "type": "ally", "name": "Rook", "subtitle": "Test Partner", "setCode": "sample-hero",
  "cycleId": "sample-hero", "collectorNumber": "2", "quantityInSet": 1, "unique": true, "cost": 2,
  "resourceIcons": { "energy": 1 }, "atk": 1, "thw": 1, "hp": 2, "consequentialDamage": { "attack": 0, "thwart": 1 },
  "aspect": "hero:x.sample-hero.01a", "traits": ["PARTNER"], "keywords": [], "deckLimit": 1,
  "text": { "printed": "Forced Response: After you play Rook, discard the top 2 cards of your deck. ...", "current": "Forced Response: After you play Rook, discard the top 2 cards of your deck. ..." },
  "abilities": [{ "id": "x.sample-hero.02.rook-forced-response" }]
}
```

### Event

Costed, `resourceIcons`. The "(attack)" or "(thwart)" in the text is in the script, not a field.

```json
{
  "id": "x.sample-hero.03", "type": "event", "name": "Sentinel Slam", "setCode": "sample-hero", "cycleId": "sample-hero",
  "collectorNumber": "3", "quantityInSet": 3, "unique": false, "cost": 2, "resourceIcons": { "physical": 1 },
  "aspect": "hero:x.sample-hero.01a", "traits": ["ATTACK", "SUPERPOWER"], "keywords": [], "deckLimit": 3,
  "text": { "printed": "Hero Action (attack): Deal 6 damage to an enemy.", "current": "Hero Action (attack): Deal 6 damage to an enemy." },
  "abilities": [{ "id": "x.sample-hero.03.sentinel-slam-action" }]
}
```

### Support

Same shape as an event (`type: "support"`, `cost`, `resourceIcons`).

```json
{
  "id": "x.sample-hero.04", "type": "support", "name": "Workshop", "setCode": "sample-hero", "cycleId": "sample-hero",
  "collectorNumber": "4", "quantityInSet": 1, "unique": true, "cost": 1, "resourceIcons": { "mental": 1 },
  "aspect": "hero:x.sample-hero.01a", "traits": ["LOCATION"], "keywords": [], "deckLimit": 1,
  "text": { "printed": "Alter-Ego Action: Exhaust Workshop → heal 3 damage from Sam Pell.", "current": "Alter-Ego Action: Exhaust Workshop → heal 3 damage from Sam Pell." },
  "abilities": [{ "id": "x.sample-hero.04.workshop-action" }]
}
```

### Upgrade

Same shape as a support plus an optional `attachesTo` (an attachment host, below) for "Attach to an ally". A permanent
upgrade or one with a printed dash cost has `"specialCost": "dash"` and `"cost": 0`.

```json
{
  "id": "x.sample-hero.05", "type": "upgrade", "name": "Sentinel Cell", "setCode": "sample-hero", "cycleId": "sample-hero",
  "collectorNumber": "5", "quantityInSet": 2, "unique": false, "cost": 1, "resourceIcons": { "energy": 1 },
  "aspect": "hero:x.sample-hero.01a", "traits": ["ITEM", "TECH"],
  "keywords": [{ "name": "uses", "count": 3, "counterType": "charge" }], "deckLimit": 2,
  "text": { "printed": "Uses (3 charge counters). ...\nHero Resource: Exhaust Sentinel Cell and remove 1 charge counter from it → generate a [wild] resource.", "current": "..." },
  "abilities": [{ "id": "x.sample-hero.05.sentinel-cell-resource" }]
}
```

### Resource

Not costed. `producesIcons` instead of `resourceIcons`. No worked example in the sample hero; shape (from the base
game's Stored Energy, `aoa` 45010):

```json
{
  "id": "x.my-hero.10", "type": "resource", "name": "Stored Energy", "setCode": "my-hero", "cycleId": "my-hero",
  "collectorNumber": "10", "quantityInSet": 3, "unique": false, "producesIcons": { "energy": 1, "physical": 1 },
  "aspect": "hero:x.my-hero.01a", "traits": ["TEMPORAL"], "keywords": [], "deckLimit": 3,
  "text": { "printed": "", "current": "" }, "abilities": []
}
```

### Player side scheme

Costed, `resourceIcons`, plus `startingThreat` (a scaling value). Used by heroes such as Cable.

```json
{
  "id": "x.my-hero.11", "type": "player_side_scheme", "name": "Hold the Line", "setCode": "my-hero", "cycleId": "my-hero",
  "collectorNumber": "11", "quantityInSet": 1, "unique": false, "cost": 1, "resourceIcons": { "mental": 1 },
  "startingThreat": { "base": 2, "perPlayer": 0 }, "aspect": "hero:x.my-hero.01a", "traits": [], "keywords": [],
  "deckLimit": 1, "text": { "printed": "...", "current": "..." }, "abilities": []
}
```

## Encounter cards

Shared by `minion`, `attachment`, `treachery`, `obligation`, `environment`, and (with their own icons) `side_scheme`:

| Field             | Notes                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `encounterSetIds` | The encounter sets the card belongs to: `["my-hero-nemesis"]`, `["my-scenario-clockwork"]`. `[]` for a hero's obligation (it is shuffled in by the identity). Ids that start with the pack id must have an `encounter-sets/` record. |
| `boostIcons`      | Number of boost icons, 0 or more. Required.                                                            |
| `starIcon`        | Optional boolean: a printed [star] boost.                                                              |
| `traits`, `keywords`, `text`, `abilities` | As above. Required.                                                            |
| `flavor`, `flipSide`, `separateDeck`, `modeOnly` | Optional (`modeOnly`: `"standard"` or `"expert"`).                              |

### Minion

Adds `atk`, `sch` (a number, `"X"`, or `null`) and `hp` (a number; optional `hpPerPlayer: true` / `hpPerGroup: true` if
the printed hp is per player). `nemesisMinion: true` is optional.

```json
{
  "id": "x.sample-hero.07", "type": "minion", "name": "Rust Warden", "setCode": "sample-hero", "cycleId": "sample-hero",
  "collectorNumber": "7", "quantityInSet": 1, "unique": true, "atk": 3, "sch": 1, "hp": 4,
  "encounterSetIds": ["sample-hero-nemesis"], "boostIcons": 2, "traits": ["ROBOT"], "keywords": [{ "name": "quickstrike" }],
  "text": { "printed": "Quickstrike. (After this minion engages your hero, it attacks.)", "current": "Quickstrike. (After this minion engages your hero, it attacks.)" },
  "abilities": []
}
```

### Side scheme

Adds `startingThreat` (a scaling value) and `icons` (a list of `"crisis"`, `"hazard"`, `"acceleration"`, `[]` for
none); `boostIcons` is required. `signatureOf` is optional.

```json
{
  "id": "x.sample-hero.08", "type": "side_scheme", "name": "Held for Ransom", "setCode": "sample-hero", "cycleId": "sample-hero",
  "collectorNumber": "8", "quantityInSet": 1, "unique": false, "encounterSetIds": ["sample-hero-nemesis"],
  "startingThreat": { "base": 0, "perPlayer": 3 }, "icons": ["acceleration"], "boostIcons": 3, "traits": [], "keywords": [],
  "text": { "printed": "When Revealed: ...\nWhen Defeated: ...", "current": "When Revealed: ...\nWhen Defeated: ..." },
  "abilities": [{ "id": "x.sample-hero.08.when-revealed" }, { "id": "x.sample-hero.08.when-defeated" }]
}
```

### Treachery

Only the shared encounter fields.

```json
{
  "id": "x.sample-hero.09", "type": "treachery", "name": "Shock Wave", "setCode": "sample-hero", "cycleId": "sample-hero",
  "collectorNumber": "9", "quantityInSet": 2, "unique": false, "encounterSetIds": ["sample-hero-nemesis"],
  "boostIcons": 0, "starIcon": true, "traits": [], "keywords": [],
  "text": { "printed": "When Revealed: ...\n[star] Boost: ...", "current": "When Revealed: ...\n[star] Boost: ..." },
  "abilities": [{ "id": "x.sample-hero.09.when-revealed" }, { "id": "x.sample-hero.09.boost" }]
}
```

### Obligation

Only the shared encounter fields; `encounterSetIds` is `[]`.

```json
{
  "id": "x.sample-hero.06", "type": "obligation", "name": "Overdue Notice", "setCode": "sample-hero", "cycleId": "sample-hero",
  "collectorNumber": "6", "quantityInSet": 1, "unique": false, "encounterSetIds": [], "boostIcons": 2, "traits": [],
  "keywords": [], "text": { "printed": "Give to the Sam Pell player. ...", "current": "Give to the Sam Pell player. ..." },
  "abilities": [{ "id": "x.sample-hero.06.obligation" }]
}
```

### Attachment

Adds `attachesTo` (the host the printed "Attach to ..." names), optional `hostChosenBy` (`"enemyTeam"`),
`playRestrictions` and `statModifiers` (`{ atk, sch, thw, hp }` printed on the card).

```json
{
  "id": "x.sample-scenario.07", "type": "attachment", "name": "Escapement Plating", "setCode": "sample-scenario",
  "cycleId": "sample-scenario", "collectorNumber": "7", "quantityInSet": 1, "unique": false,
  "attachesTo": { "kind": "villain" }, "encounterSetIds": ["sample-scenario-clockwork"], "boostIcons": 0, "traits": ["ARMOR"],
  "keywords": [], "text": { "printed": "Attach to The Clockmaker.\nForced Interrupt: ...", "current": "Attach to The Clockmaker.\nForced Interrupt: ..." },
  "abilities": [{ "id": "x.sample-scenario.07.escapement-plating-forced-interrupt" }]
}
```

`attachesTo.kind` is one of `villain`, `namedVillain` (`name`), `mainScheme`, `sideScheme`, `scheme`, `hero`,
`yourIdentity`, `ally`, `minion`, `enemy`, `anyCharacter`, `friendlyCharacter`, `namedCard` (`name`), `qualified` (a
`category` plus `trait`, `keyword`, ... filters), `anyOf` (`hosts`), `encounterCard`, `anyCard`, and a few more; the full
list with fields is `attachment-host.ts`.

### Environment

Only the shared encounter fields, a card that stays in play. No sample; shape from the base game (`aoa`, the environments
in `packages/content/src/data/aoa/cards.ts`):

```json
{
  "id": "x.my-scenario.12", "type": "environment", "name": "Crumbling Ruins", "setCode": "my-scenario", "cycleId": "my-scenario",
  "collectorNumber": "12", "quantityInSet": 1, "unique": false, "encounterSetIds": ["my-scenario-ruins"], "boostIcons": 0,
  "traits": ["LOCATION"], "keywords": [], "text": { "printed": "...", "current": "..." }, "abilities": []
}
```

## Villain, main scheme

### Villain

One record with `sides` (`"A"`, `"B"`, `"C"`), each with `stages` (`stageNumber` 1, 2, 3). A stage needs `stageNumber`,
`hp` (scaling value), `atk`, `sch`, `text`, `traits`, `keywords`, `abilities`. Optional: `stageLabel`, `infiniteHp`,
`dashedStats`, `image`. The record has `encounterSetIds`; optional `startingSide`, `printedType: "leader"`,
`activationOrder`.

```json
{
  "id": "x.sample-scenario.01", "type": "villain", "name": "The Clockmaker", "setCode": "sample-scenario",
  "cycleId": "sample-scenario", "collectorNumber": "1/2", "quantityInSet": 1, "unique": true,
  "encounterSetIds": ["sample-scenario-clockwork"],
  "sides": [{ "side": "A", "name": "The Clockmaker", "stages": [
    { "stageNumber": 1, "hp": { "base": 0, "perPlayer": 12 }, "atk": 2, "sch": 1, "text": { "printed": "", "current": "" }, "traits": ["INVENTOR", "CRIMINAL"], "keywords": [], "abilities": [] },
    { "stageNumber": 2, "hp": { "base": 0, "perPlayer": 14 }, "atk": 3, "sch": 1, "text": { "printed": "When Revealed: ...", "current": "When Revealed: ..." }, "traits": ["INVENTOR", "CRIMINAL"], "keywords": [], "abilities": [{ "id": "x.sample-scenario.01.stage-two-when-revealed" }] }
  ] }]
}
```

### Main scheme

One record with `stages`. Each stage: `stageNumber`, `startingThreat`, `targetThreat`, `acceleration` (scaling values),
`icons`, `text`, `traits`, `keywords`, `abilities`, and an `aSide` (`{ text, abilities }`, the stage's A side text).
Optional per stage: `name`, `completionLoses`, `onCompletion`, `printedX`, `dashedValues`. The record has
`encounterSetIds`.

```json
{
  "id": "x.sample-scenario.02a", "type": "main_scheme", "name": "Ticking Away", "setCode": "sample-scenario",
  "cycleId": "sample-scenario", "collectorNumber": "2A/2B/3A/3B", "quantityInSet": 1, "unique": false,
  "encounterSetIds": ["sample-scenario-clockwork"],
  "stages": [
    { "stageNumber": 1, "startingThreat": { "base": 0, "perPlayer": 0 }, "targetThreat": { "base": 0, "perPlayer": 6 },
      "acceleration": { "base": 0, "perPlayer": 1 }, "icons": [],
      "text": { "printed": "If this stage is completed, advance to stage 2.", "current": "If this stage is completed, advance to stage 2." },
      "traits": [], "keywords": [], "abilities": [],
      "aSide": { "text": { "printed": "Setup: Advance to stage 1B.", "current": "Setup: Advance to stage 1B." }, "abilities": [{ "id": "x.sample-scenario.02a.setup" }] } }
  ]
}
```

## Other records in a pack

- `encounter-sets/<id>.json`: `{ "id", "name", "packCodes": ["<pack-id>"] }`, plus `"nemesisOfIdentityId": "<identity code>"`
  for a hero's nemesis set. A set id on a pack card that starts with the pack id must have one.
- `decks/<pack-id>-<name>.json`: `{ "id", "name", "packCode", "identityCardId", "aspects": ["justice"], "cards": [{ "cardId", "quantity" }] }`.
  A deck may mix pack and base-game codes. The identity and each card must exist.
- `scenarios/<id>.json`: `{ "id", "name", "packCode", "villainCardId", "mainSchemeCardId", "encounterSetIds", "recommendedModularSetIds", "standardEncounterSetIds": ["standard"], "expertEncounterSetIds": ["expert"], "villainStages": { "standard": [1, 2], "expert": [2, 2] } }`.
  Only these plain fields are allowed.
- `campaigns/<id>.json`: see `content-packs/sample-scenario/campaigns/sample-scenario-crisis.json` in the game repo and
  the SDK README's "Campaigns" section; a first version is a linear campaign with fixed scenarios and base heroes.
- `pack.json`: see [pack-metadata.md](pack-metadata.md).
