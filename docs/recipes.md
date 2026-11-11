# Recipes: card text to script

How to turn common card text into an ability script. Every recipe names the card it was copied from. The scripts
below were type-checked and loaded with `definePackAbilities` against SDK 0.43, so their builders and arguments are
current; the card text and ids are examples.

Conventions used in every snippet:

- All names (`heroAction`, `attackAnEnemy`, `query`, ...) are imported from `@champions-digital-game/mod-sdk`. The
  snippets leave the `import` out; your `abilities/index.ts` imports each name it uses.
- Keys are ability ids, `<card code>.<slug>`, and each id must also be listed in that card's `abilities` array in
  `cards/<code>.json` (see [card-json.md](card-json.md)). The snippets use the pack id `my-hero`.
- Each snippet is the inside of `export default definePackAbilities({ ... })`.
- Names and signatures are in [dsl-reference.md](dsl-reference.md) and the generated
  [dsl-reference-generated.md](dsl-reference-generated.md). To find another card that does what yours does, see
  [finding-a-precedent.md](finding-a-precedent.md).
- A keyword that the card prints (Retaliate, Toughness, Guard, Surge, ...) is data in the card's `keywords`, not a
  script. See the keyword recipes near the end.

## Player cards

### Deal X damage to an enemy: an attack, and plain damage

Card text: "Hero Action (attack): Deal 6 damage to an enemy." Swinging Web Kick, Spider-Man 01005; Sentinel Slam in the
sample hero.

```ts
definePackAbilities({
  "x.my-hero.03.slam-action": heroAction({ label: "attack" }, attackAnEnemy(6)),
});
```

`label: "attack"` matters: it makes the ability an attack (confusion, Guard, Retaliate and "attacks" triggers apply).
Without the printed "(attack)" the damage is not an attack, and the script is `damageAnEnemy(1)` (Night Thrasher's
Battle Board back face, `x.night-thrasher-dh.02b.battle-board-response`). A thwart is the same with
`heroAction({ label: "thwart" }, thwartAScheme(2))`. "Remove 2 threat from a scheme" without "(thwart)" is
`removeThreatFromAScheme(2)`.

### After you play this card (a Forced Response)

Card text: "Forced Response: After you play Rook, discard the top 2 cards of your deck. Add each card with a printed
[physical] resource to your hand." Black Cat, 01002; Rook in the sample hero.

```ts
definePackAbilities({
  "x.my-hero.02.rook-forced-response": forcedResponse(
    after.youPlayThis(),
    moveCards(topOfDeck(2), "discard", "milled"),
    moveCards(cards(chosen("milled"), { printedResource: "physical" }), "hand"),
  ),
});
```

The timing word picks the builder: "Interrupt" is `interrupt` or `forcedInterrupt` with `when.*`, "Response" is
`response` or `forcedResponse` with `after.*`. A hero-only or alter-ego-only ability uses `heroInterrupt`,
`alterEgoResponse` and so on. "Forced" means no choice: use the `forced...` builder. "You may" abilities are the plain
`interrupt` and `response`.

### After you play an event or another kind of card

Card text: "Response: After you play a Skill card, flip the Battle Board upgrade. (Limit once per phase.)" Night Thrasher
`x.night-thrasher-dh.01a.varial-heelflip`.

```ts
const SKILL_CARD = query(["event", "upgrade", "support", "ally", "resource"], { trait: "SKILL" as never });
const BATTLE_BOARD = query("upgrade", { name: "Battle Board", controller: "you" });

definePackAbilities({
  "x.my-hero.01a.heelflip": response(
    on.youPlayedCard(SKILL_CARD),
    { limit: oncePerPhase },
    flipCard(each(BATTLE_BOARD)),
  ),
});
```

A trait in a query is its upper-case name (`"SKILL"`). The packs write a small `trait("Skill")` helper for this.
`query(category-or-list, filters)` is the one way to say "which cards" everywhere (see the reference).

### Once per round, and other limits

Card text: "Resource: Generate a [physical] resource. (Limit once per round.)" Peter Parker's Scientist, 01001b; Sample
Sentinel's Quiet Study.

```ts
definePackAbilities({
  "x.my-hero.01b.quiet-study": resource({ physical: 1 }, { limit: oncePerRound }),
  "x.my-hero.01a.reading": action({ limit: oncePerRound }, draw(1)),
});
```

The limits are `oncePerRound`, `oncePerPhase`, `oncePerRoundPerPlayer` and a few more (search the reference for
"Limit"). The limit goes in the options object, which comes first.

### Uses (X charge counters) and a resource that spends them

Card text: "Uses (3 charge counters). Hero Resource: Exhaust this and remove 1 charge counter from it: generate a [wild]
resource." Web-Shooter, 01008; Sentinel Cell in the sample hero.

In the card JSON: `"keywords": [{ "name": "uses", "count": 3, "counterType": "charge" }]`. The script:

```ts
definePackAbilities({
  "x.my-hero.05.cell-resource": heroResource({ wild: 1 }, { cost: [exhaustThis, removeCounter("charge")] }),
});
```

The Uses keyword puts the counters on the card and discards it when the last one goes; the script only pays the cost.
Counters you invent (not Uses) are `addCounters("defeated", 1)` and `countersOn(self, "defeated")`; remove them with
`removeEachCounterFrom(self, "defeated")` (Carnage, `x.carnage-nep.01a.need-to-kill`).

### A cost: exhaust, spend a resource, discard from hand

```ts
definePackAbilities({
  "x.my-hero.04.workshop-action": alterEgoAction({ cost: exhaustThis }, heal(3, yourIdentity)),
  "x.my-hero.06.pay-action": heroAction({ cost: [exhaustThis, spend({ energy: 1 })] }, draw(1)),
  "x.my-hero.07.discard-x": action(
    { limit: oncePerRound, cost: discardFromHandCost(0, undefined, "x") },
    draw(varOf("x")),
  ),
});
```

Sources: Aunt May 01006 (exhaust, heal the identity); Gwenpool `x.gwenpool-ptt.01b.thats-not-fair` after Shield Toss
03006 (discard X cards, draw X). The text before the arrow is the cost; the text after it is the effects. A cost the
player cannot pay means the ability is not offered (RRG "Cost").

### Resource that generates only for some cards

Card text: "Resource: Exhaust this: generate a [wild] resource that can only be spent on a Skill card." Multi-Skilled,
Night Thrasher `x.night-thrasher-dh.10.multi-skilled-resource`, after Jet Belt (Wonder Man 58008).

```ts
definePackAbilities({
  "x.my-hero.10.multi-skilled-resource": resource(
    { wild: 1 },
    { cost: exhaustThis, generatesFor: query(["event", "upgrade"], { trait: "SKILL" as never }) },
  ),
});
```

`resource` works in either form. A "Hero Resource:" is `heroResource`. A printed resource icon on the card (the icons
in the corner) is data, `resourceIcons`, not a script.

### Cost modifiers: "reduce the cost to play this card by 1 if..."

Card text: "If the last card you played this round was a Night Thrasher event, reduce the cost to play this card by 1."
Kickflip, `x.night-thrasher-dh.05.kickflip-constant`.

```ts
definePackAbilities({
  "x.my-hero.05.kickflip-constant": constant(
    costModifier({
      delta: -1,
      appliesTo: { self: true },
      activeIn: "hand",
      while: lastPlayedThisRound(query("event", { identitySetOf: you })),
    }),
  ),
});
```

"Reduce the cost of the next card you play" is an effect, `reduceNextCardCost(you, 1, "phase", query("event"))` (spans
`"phase"`, `"round"`, `"turn"`), used by Carnage's Lethal Restraint and Night Thrasher's The Mancave.

### Constant bonuses: "gets +1 DEF", "gains Retaliate 1"

Card text: "Night Thrasher gets +1 DEF and gains Retaliate 1." Prewind Stance, `x.night-thrasher-dh.11.prewind-stance-constant`,
after Captain America's Shield 03009.

```ts
definePackAbilities({
  "x.my-hero.11.stance-constant": constant(
    gets("def", 1, YOUR_IDENTITY, { while: isHero() }),
    gainsKeyword({ name: "retaliate", value: 1 }, YOUR_IDENTITY),
  ),
});
```

`constant(...)` takes every always-on part of the card. Stat bonuses to your attacks (`attacksGainKeywords`), rules
(`rule({ kind: ... })`, `cannotMakeBasicAttacks`, `cannotFlip`) and traits (`gainsTrait`) are other parts.

### Agile-style damage reduction (a custom keyword defined by its reminder text)

Card text: "Night Thrasher gets +1 THW and gains Agile 1. (Agile X: reduce damage taken from undefended villain and
villainous attacks by X.)" Battle Board front, `x.night-thrasher-dh.02a.battle-board-constant`.

```ts
definePackAbilities({
  "x.my-hero.02a.board-constant": constant(
    gets("thw", 1, YOUR_IDENTITY, { while: isHero() }),
    agile(1, { categories: ["hero"], controller: "you" }),
  ),
});
```

Agile is not an official keyword; the engine has a primitive for it because a community pack defined it. If your
custom keyword has no primitive, do not fake it: report it (see AGENTS.md).

### Tagged "bubble" abilities (resolved by another card)

Card text: Gwenpool's speech bubbles. Gwenpool `x.gwenpool-ptt.01a.reading-the-comic` and `.pink-bubble`.

```ts
definePackAbilities({
  "x.my-hero.01a.reading-the-comic": action({ limit: oncePerRound }, resolveOneTagged("pinkBubble")),
  "x.my-hero.01a.pink-bubble": tagged("pinkBubble", draw(1)),
  "x.my-hero.02.pink-bubble": tagged("pinkBubble"),
  "x.my-hero.03.pink-bubble": tagged("pinkBubble", anEnemy("enemy"), dealDamage(2, chosen("enemy"))),
});
```

A `tagged` ability has no trigger. It resolves only when an effect names its tag (`resolveTagged("pinkBubble")` for
all of them, `resolveOneTagged` for one the player picks) and counts for `taggedAbilitiesOn` and `hasTaggedAbility`.
A flavor-only bubble is `tagged(tag)` with no effects.

### Extra player phase

Card text: "Forced Interrupt: When the villain phase is about to begin, instead remove this card from the game: start
another player phase." Gwenpool's Out of the Game, `x.gwenpool-ptt.07.out-of-the-game-forced-interrupt`.

```ts
definePackAbilities({
  "x.my-hero.07.out-of-the-game": forcedInterrupt(
    on.phaseBeginning("villain"),
    cancelIt(),
    moveCards(cards(self), "removedFromGame"),
    replaceNextVillainPhaseWithPlayerPhase(),
  ),
});
```

### Choose one, and "if you do" style branches

```ts
definePackAbilities({
  "x.my-hero.08.choice": heroAction(
    chooseOne(
      option("Draw 2 cards", draw(2)),
      option("Heal 2 damage", { when: isHero() }, heal(2, yourIdentity)),
    ),
  ),
  "x.my-hero.09.branch": heroAction(
    { label: "attack" },
    attackAnEnemy(2),
    ifThen(inPlay("Rook"), draw(1)),
  ),
});
```

`option(label, { when }, ...effects)`: `when` hides an option that cannot happen. `ifThen(predicate, then, otherwise?)`
is "if X, then Y". Night Thrasher's Disaster (`x.night-thrasher-dh.03.disaster-constant`) chains `ifThen`s after a flip,
and its Practice obligation (`x.night-thrasher-dh.12.obligation`) shows `chooseOne` with costs inside options. A
"Then" in the printed text reads state after the first step (RRG 1.8 "'Then'", p. 44).

### Per-player blanking, and "each player"

Card text: "Action: Each player may discard 1 card from their hand. Each player who did may treat this card's text box as if
it were blank until the end of the phase." Cemented, `x.night-thrasher-dh.14.cemented-action`.

```ts
definePackAbilities({
  "x.my-hero.14.cemented-action": action(
    forEachPlayer(
      eachPlayer,
      chooseOneBy(
        thatPlayer,
        option(
          "Discard 1 card from your hand and treat this text box as blank until the end of the phase",
          { when: valueAtLeast(handCountOf(thatPlayer), 1) },
          discardFromHand(1, thatPlayer),
          blankTextBoxForPlayers(self, thatPlayer, "endOfPhase"),
        ),
        option("Do not discard"),
      ),
    ),
  ),
});
```

### A random pick among cards in play

Card text: "Discard 1 upgrade you control at random." Gwenpool's "Hello Again",
`x.gwenpool-ptt.15.when-revealed`.

```ts
definePackAbilities({
  "x.my-hero.15.when-revealed": whenRevealed(
    selectCards("upgrade", cards(each(query("upgrade", { controller: "you" })), undefined, { random: 1 })),
    discard(chosen("upgrade")),
  ),
});
```

Randomness goes through the game's seeded RNG (`random: 1`, or `discardAtRandom(1)` for a hand), so replays match.

### Heal, stun, confuse, draw, ready, exhaust

One-liners (the target is a `TargetRef`: `yourIdentity`, `self`, `chosen("slot")` after `anEnemy("slot")`, or
`each(query(...))`):

```ts
definePackAbilities({
  "x.my-hero.16.misc": heroAction(
    heal(2, yourIdentity),
    anEnemy("enemy"),
    stun(chosen("enemy")),
    confuse(chosen("enemy")),
    draw(1),
    exhaust(self),
    ready(self),
  ),
});
```

## Obligation, nemesis and the hero's encounter cards

### The obligation

Card text: "Give to the Sam Pell player. You may flip to alter-ego form. Choose one: [A] Exhaust Sam Pell, remove this
from the game. [B] Discard 1 card at random from your hand, this card gains surge, discard this obligation." Overdue
Notice, after Eviction Notice 01165.

```ts
definePackAbilities({
  "x.my-hero.06.obligation": packObligation("Sam Pell", {
    label: "Discard 1 card at random from your hand; this card gains surge",
    effects: [discardAtRandom(1), surge()],
  }),
});
```

`packObligation(alterEgoName, secondOption)` writes the usual shape: flip option, then choose between exhausting the
alter ego to remove the card and your own penalty. A different obligation (Night Thrasher's Practice) is a plain
`whenRevealed(chooseOne(...))`.

Wiring in card JSON: the identity record has `"obligationCardId": "x.my-hero.06"` and
`"nemesisEncounterSetId": "my-hero-nemesis"`; the obligation card has `"encounterSetIds": []`; each nemesis card
(minion, side scheme, treachery) has `"encounterSetIds": ["my-hero-nemesis"]`; and `encounter-sets/my-hero-nemesis.json`
is

```json
{ "id": "my-hero-nemesis", "name": "My Hero Nemesis", "packCodes": ["my-hero"], "nemesisOfIdentityId": "x.my-hero.01a" }
```

### When Revealed, surge, and a treachery that names another card

Card text: "When Revealed: Stun your hero. If Rust Warden is in play, this card gains surge." Shock Wave, after Sweeping
Swoop 01168.

```ts
definePackAbilities({
  "x.my-hero.09.when-revealed": whenRevealed(
    ifThen(isHero(), stun(yourIdentity)),
    ifThen(inPlay("Rust Warden"), surge()),
  ),
});
```

`surge()` is "this card gains surge" as an effect. A printed Surge keyword is data: `{ "name": "surge" }`. A card that
names another writes its exact printed name (`inPlay("Rust Warden")`). An alter ego is not stunned (RRG 1.8 "Form,
Change Form", p. 21), which is why the stun is guarded by `isHero()`.

### Boost abilities

Card text: "[star] Boost: If this activation deals damage to a friendly character, stun that character." Shock Wave,
after Sweeping Swoop.

```ts
definePackAbilities({
  "x.my-hero.09.boost": boost(
    atEndOfAttack(ifThen(allOf(eventDealt("damage"), refMatches(eventTarget, FRIENDLY_CHARACTER)), stun(eventTarget))),
  ),
});
```

In the card JSON a boost icon count is `"boostIcons": 2` and a printed star is `"starIcon": true`. A boost ability is
`boost(...)`; "you" in it is the player the activation is against.

### Forced interrupt that replaces damage

Card text: "Forced Interrupt: When any amount of damage would be dealt to The Clockmaker, place it here instead. Then, if
there is at least 4 damage here, discard this card." Escapement Plating in the sample scenario, after Armored Rhino
Suit 01098.

```ts
definePackAbilities({
  "x.my-hero.20.plating-forced-interrupt": forcedInterrupt(
    when.damage(query("villain")),
    { wouldBeDealt: true },
    instead(placeDamage(eventAmount, self), andThen(ifThen(damagedAtLeast(self, 4), discard(self)))),
  ),
});
```

"Would" wording is data on the ability (`{ would: true }`, `{ wouldBeDealt: true }`) and `instead(...)` is the
replacement; see the options on `AbilityOptions` in the reference.

### Villain stages, a main scheme and "When Revealed" on a stage

Villains are one record with `sides[].stages[]` (see [card-json.md](card-json.md)); each stage lists its own abilities.
The ability id for a stage text is `<villain code>.<slug>` and any stage may use it.

Card text (stage II): "When Revealed: Search the encounter deck and discard pile for the Stopped Clocks side scheme
and reveal it. Shuffle the encounter deck." Sample scenario, after Rhino (II) 01095.

```ts
definePackAbilities({
  "x.my-hero.01.stage-two-when-revealed": whenRevealed(searchAndReveal("Stopped Clocks")),
  "x.my-hero.02a.setup": setup(),
});
```

Main scheme 1A "Setup: Advance to stage 1B" is `setup()` (the engine always continues onto the B side; The Break-In!
01097a). A main scheme's threat numbers are data: `startingThreat`, `targetThreat`, `acceleration`, each
`{ "base": 0, "perPlayer": 6 }`.

### Side scheme with crisis, hazard or acceleration icons

Card text: "When Revealed: Place an additional 1 [per_hero] threat here." Stopped Clocks, after Breakin' & Takin' 01107.

```ts
definePackAbilities({
  "x.my-hero.05.when-revealed": whenRevealed(placeThreat(perHero(1), self)),
  "x.my-hero.08.when-revealed": whenRevealed(placeThreat(1, theMainScheme)),
});
```

Icons are data on the side scheme: `"icons": ["crisis"]`, `["hazard"]` or `["acceleration"]`; starting threat is
`"startingThreat": { "base": 2, "perPlayer": 0 }`. The engine applies crisis, hazard and acceleration itself. Hinder is
a keyword: `{ "name": "hinder", "value": 1, "perPlayer": 1 }`.

### Dealing damage when a card is revealed

Card text: "When Revealed: Deal 1 damage to each hero." Pendulum Guard, after Shocker 01103.

```ts
definePackAbilities({
  "x.my-hero.04.when-revealed": whenRevealed(dealDamage(1, each(query("hero")))),
  "x.my-hero.06.when-revealed": whenRevealed(
    heal(4, theVillain, { bind: "healed" }),
    ifThen(not(varAtLeast("healed.amount")), surge()),
  ),
});
```

The second is Overwind, after Hard to Keep Down 01104: `bind: "healed"` names the result, and `healed.amount` is how
much was healed ("if no damage was healed this way").

## Keywords (data, not scripts)

Write these in the card JSON `keywords` array, and keep the keyword's reminder text in `text`:

| Printed                | JSON                                                              |
| ---------------------- | ----------------------------------------------------------------- |
| Guard, Patrol, Surge   | `{ "name": "guard" }`, `{ "name": "patrol" }`, `{ "name": "surge" }` |
| Quickstrike, Peril     | `{ "name": "quickstrike" }`, `{ "name": "peril" }`                |
| Retaliate 1            | `{ "name": "retaliate", "value": 1 }`                             |
| Toughness, Overkill, Piercing, Ranged, Villainous, Permanent, Restricted, Stalwart, Assault | `{ "name": "toughness" }` and so on |
| Uses (3 charge counters) | `{ "name": "uses", "count": 3, "counterType": "charge" }`       |
| Hinder 1 per hero      | `{ "name": "hinder", "value": 1, "perPlayer": 1 }`                 |
| Victory 1              | `{ "name": "victory", "value": 1 }`                               |
| Incite 1               | `{ "name": "incite", "value": 1 }`                                |
| Teamwork (shared trait)| `{ "name": "teamwork", "sharedTrait": "AVENGER" }`                |

The complete list and shapes are in [card-json.md](card-json.md). If a printed keyword is not in that list, the engine
does not have it yet (see AGENTS.md: report, do not fake).

## Deck-building exceptions on an identity

"You may include up to 5 Attack events from other aspects in your deck." is data on the identity record
(`deckbuilding.offAspectAllowance`, after Gamora 18001b), not a script; the identity's alter-ego face then lists
`coveredByEngineRule()` or an empty `constant()` for the printed line (see `x.carnage-nep.01b.eddie-brock-constant` and
`x.night-thrasher-dh.01b.dwayne-taylor-constant`).
