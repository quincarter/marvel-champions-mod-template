# Ability DSL reference

The ability DSL is a set of builder functions, imported from `@champions-digital-game/mod-sdk`, that you call in
`abilities/index.ts`. Each builder returns plain data (JSON); the game's engine runs that data. Nothing in a pack is
executable code.

This guide groups the builders by what they do, with a signature, a one-line meaning and a short example for the
ones you will use most. It is not the complete list. The complete, current list of every builder is
[dsl-reference-generated.md](dsl-reference-generated.md) (name, signature and the first sentence of its doc comment),
which is generated from the game's source, so it is the one to search when this guide does not have what you need.

Every snippet below was checked against SDK 0.43: its types compile and `definePackAbilities` accepts it. The snippets
leave out the `import` line; import each name you use.

## The shape of a script

```ts
import { definePackAbilities, heroAction, attackAnEnemy } from "@champions-digital-game/mod-sdk";

export default definePackAbilities({
  "x.my-hero.03.slam-action": heroAction({ label: "attack" }, attackAnEnemy(6)),
});
```

- The key is the ability id, `<card code>.<slug>`, and must match an entry in that card's `abilities` array.
- An ability is built by a **shape** (`heroAction`, `forcedResponse`, `constant`, `whenRevealed`, ...) given, in any
  order after the first argument rules below, an **options object** and the **effects**.
- The options object (`{ cost, limit, label, while, ... }`) comes first. The effects follow. An effect argument may be
  one effect, a list of effects, or a helper that returns a list (`attackAnEnemy(6)` returns a list).
- `definePackAbilities` checks every definition and throws on the first problem, so a mistake fails the first time
  the pack loads (in `npm run validate`).
- Printed wording maps to a builder: **Interrupt/When** to `interrupt` + `when.*`; **Response/After** to `response` +
  `after.*`; **Forced** to `forcedInterrupt` / `forcedResponse`; **Hero Action** to `heroAction`; **Alter-Ego
  Action** to `alterEgoAction`; **Action** to `action`; **Resource** to `resource`; **When Revealed** to
  `whenRevealed`; **Boost** to `boost`; the rest are in the sections below.

## Ability shapes

| Builder                                                       | Printed wording                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| `action`, `heroAction`, `alterEgoAction`, `firstPlayerAction` | "Action:", "Hero Action:", "Alter-Ego Action:", "First Player Action:" |
| `forcedAction`                                                | "Forced Action:"                                             |
| `resource(generates, options)`, `heroResource(...)`           | "Resource:" / "Hero Resource:" (what it generates: `{ physical: 1 }`, `{ wild: 1 }`) |
| `interrupt`, `heroInterrupt`, `alterEgoInterrupt`, `forcedInterrupt` | "Interrupt:", "Hero Interrupt:", ... "Forced Interrupt:"     |
| `response`, `heroResponse`, `alterEgoResponse`, `forcedResponse`     | "Response:", ... "Forced Response:"                          |
| `special`                                                     | "Special:" (runs only when another ability resolves it)      |
| `tagged(tag, ...)`                                            | A triggerless ability another card resolves by tag ("speech bubbles"). |
| `constant(...parts)`                                          | Always-on text: stat bonuses, keywords granted, rules, cost modifiers. |
| `whenRevealed`, `whenRevealedHero`, `whenRevealedAlterEgo`    | "When Revealed:", ... (hero / alter-ego form only)           |
| `whenDefeated`                                                | "When Defeated:"                                             |
| `boost(...)`                                                  | "Boost:" (an encounter card's boost text)                    |
| `setup`                                                       | "Setup:"                                                     |
| `preparation`, `cannotAttach`, `stateCheck`, `whenCompleted`  | "Preparation:", "if you cannot attach", an "as long as" check, "When Completed" |
| `packObligation(alterEgoName, secondOption)`                  | A hero's obligation card (see [recipes.md](recipes.md)).      |

`heroAction({ label: "attack" }, ...)`: the `label` is the printed "(attack)", "(thwart)" or "(defense)"; it changes
how the engine resolves the ability (a labeled attack is an attack for Guard, Retaliate and "after you attack"
triggers).

Options (`AbilityOptions`): `cost`, `limit`, `label`, `while` (a condition), `firstPlayerOnly`, `triggerableBy`,
`would` / `wouldBeDealt` (wording "would"), `notWhileResolving`, `readsPaidTypes`, `minX`, `costEffects`,
`playCostReduction`. Each has a doc comment; read them in the type or in the generated reference.

```ts
definePackAbilities({
  "x.my-hero.01a.sense": interrupt(when.villainAttacks({ againstYou: true }), draw(1)),
  "x.my-hero.01b.study": resource({ physical: 1 }, { limit: oncePerRound }),
  "x.my-hero.04.workshop": alterEgoAction({ cost: exhaustThis }, heal(3, yourIdentity)),
});
```

## Event patterns: `when.*`, `after.*`, `on.*`

`when`, `after` and `on` are the same object; pick `when` for interrupts and `after` for responses so the code reads
like the card. Members, by what they listen for (all in the generated reference under "Event patterns"):

- Enemy actions: `villainAttacks`, `enemyAttacks`, `enemySchemes`, `enemyActivates`, `enemyActivating`, `defends`.
- Your actions: `attacks(who, { defeats })`, `thwarts`, `attacksOrThwarts`, `youAttackOrDefend`, `youDealDamage`,
  `basicPowerUsed`.
- Cards played and entering play: `youPlayThis`, `youPlayThisFromHand`, `youPlay(query)`, `youPlayedCard(query)`,
  `cardPlayed`, `entersPlay`, `leavesPlay`, `cardAttached`.
- Damage and threat: `damage(target)` (when damage would be dealt or is dealt), `defeated(who)`, `defeats`,
  `threatPlaced`, `lastThreatRemoved`, `schemeDefeated`, `mainSchemeCompleted`.
- Timing: `phaseBeginning("villain")`, `phaseEnding`, `roundEnding`, `yourTurnBegins`.
- Encounter cards: `encounterCardRevealed`, `youRevealEncounterCard`, `youResolveTreachery`.
- Form: `youChangeForm`, `playerChangesForm`, `characterFlips`.
- Combinators: `on.either(a, b)` ("after A or B").

```ts
definePackAbilities({
  "x.my-hero.02.rook": forcedResponse(after.youPlayThis(), draw(1)),
  "x.my-hero.05.guard": forcedInterrupt(on.phaseBeginning("villain"), draw(1)),
  "x.my-hero.06.either": response(on.either(on.yourTurnBegins(), on.phaseBeginning("villain")), draw(1)),
});
```

## Costs

A cost is what is before the arrow. Pass one in `{ cost }`, or several in a list: `{ cost: [exhaustThis, spend({ energy: 1 })] }`.
`exhaustThis`, `discardThis`, `flipThis`, `spend(resources)`, `spendX`, `spendEqualTo`, `removeCounter(type, n?)`,
`takeDamageCost`, `damageThisCardCost`, `healCost`, `discardFromHandCost(min, max?, bind?, filter?)`,
`discardTopOfDeckCost`, `exhaustYourHero`, `returnToHandCost(query)`, `discardCardsCost`, `chooseCardCost`,
`removeThreatCost`, `eitherCost(a, b)`, `costIf(predicate, cost)`, `payPrintedCostOf`, `additionalCostToPlay`.

The limits are `oncePerRound`, `oncePerPhase`, `oncePerRoundPerPlayer`, `oncePerPhasePerEventPlayer`,
`maxOnePerTriggeringInstance`, `oncePerPaidCard`.

## Effects

An effect is a data object you pass as an argument. The common ones:

| Group                 | Builders                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Damage, healing, threat | `dealDamage(n, target, opts?)`, `attack(n, target, opts?)`, `thwart(n, target, opts?)`, `heal(n, target)`, `takeDamage`, `placeThreat(n, target)`, `removeThreat(n, target)`, `placeDamage`, `setRemainingHitPoints`, `dealIndirectDamage(player, n)`, `divide("damage", n, query)` |
| Phrase sugar          | `attackAnEnemy(n)`, `thwartAScheme(n)`, `damageAnEnemy(n)`, `removeThreatFromAScheme(n)`, `anEnemy(slot)`, `anAttackableEnemy(slot)`, `aScheme(slot)` |
| Cards                 | `draw(n)`, `drawUpTo`, `moveCards(selector, destination, bind?)`, `discard(target)`, `discardAtRandom(n)`, `discardFromHand(n)`, `shuffleDeck()`, `putIntoPlay(card)`, `findCard(query, to)`, `tuckCards`, `attachCard`, `flipCard`, `changeForm`, `revealCard`, `lookAt` |
| Statuses              | `stun(target)`, `confuse(target)`, `giveTough(target)`, `removeStatus`, `exhaust(target)`, `ready(target)`        |
| Counters              | `addCounters(type, n, target?)`, `removeCountersFrom`, `removeEachCounterFrom(target, type)`, `moveCounters`      |
| Control flow          | `ifThen(predicate, then, otherwise?)`, `andThen(...)` ("Then"), `sentence(...)`, `chooseOne(option(...), ...)`, `chooseOneBy(player, ...)`, `forEachPlayer(players, ...)`, `repeatTimes(n, ...)`, `forEachCard`, `setVar`, `bindTargets`, `chooseTarget(slot, query)`, `chooseCards(slot, selector, { min, max })`, `selectCards` |
| Replacement           | `instead(...)`, `cancelIt()`, `preventDamage(n?)`, `reduceDamage`, `increaseDamage`, `preventThreat`, `retargetAttack`, `modifyAttack(change)` |
| Enemy activations     | `enemyAttack`, `enemyScheme`, `enemyActivates`, `atEndOfAttack(...)`, `atEndOfRound(...)`, `atEndOfActivation(...)` |
| Encounter deck        | `revealEncounterCard`, `dealEncounterCard`, `discardEncounterCards(n, { bind })`, `discardEncounterUntil(query, bind)`, `searchAndReveal(name)`, `shuffleEncounterDeck()`, `surge()` |
| Scenario flow         | `addAccelerationToken`, `advanceMainScheme`, `swapVillain`, `setVillainSide`, `skipNextVillainPhase`, `replaceNextVillainPhaseWithPlayerPhase` |
| Tags                  | `resolveTagged(tag, opts?)`, `resolveOneTagged(tag)`                                                                |

```ts
definePackAbilities({
  "x.my-hero.03.slam": heroAction({ label: "attack" }, attackAnEnemy(6)),
  "x.my-hero.04.mix": heroAction(
    anEnemy("foe"),
    dealDamage(2, chosen("foe")),
    stun(chosen("foe")),
    ifThen(isHero(), draw(1)),
  ),
  "x.my-hero.05.pick": heroAction(
    chooseOne(option("Heal 3", heal(3, yourIdentity)), option("Draw 2", draw(2))),
  ),
});
```

## Targets and queries

There are three related ideas.

- A **PlayerRef** says which player: `you`, `eachPlayer`, `thatPlayer` (inside `forEachPlayer`), `firstPlayer`,
  `otherPlayers()`, `controllerOf(card)`, `ownerOf(card)`, `chosenPlayer(slot)`.
- A **TargetRef** names card(s) an effect acts on: `self`, `host` (what this card is attached to), `yourIdentity`,
  `theVillain`, `theMainScheme`, `eventTarget` (the card the triggering event happened to), `eventSource`,
  `chosen(slot)` (cards picked by an earlier `anEnemy`, `chooseTarget`, `chooseCards` or `bind`), `each(query)`,
  `named("Exact Name")`, `superlative("highest", among, measure)`.
- A **TargetQuery** says which cards match, built with `query(categories, filters)`: the categories are `"character"`,
  `"enemy"`, `"villain"`, `"minion"`, `"ally"`, `"hero"`, `"alterEgo"`, `"identity"`, `"scheme"`, `"mainScheme"`,
  `"sideScheme"`, `"upgrade"`, `"support"`, `"attachment"`, `"event"`, `"resource"`, `"treachery"`, `"obligation"`,
  `"environment"`. Filters include `controller: "you" | "other" | "any" | "encounter"`, `trait`, `withoutTrait`,
  `anyTrait`, `withKeyword`, `name`, `exhausted`, `engagedWith`, `self`, `not`, `anyOf`, and helpers such as
  `sharesTraitWith(ref)`, `printedCostAtLeast(n)`, `statCompare(stat, op, value)`, `sameClassificationAs(ref)`.
  Premade queries: `YOUR_IDENTITY`, `YOUR_HERO`, `FRIENDLY_CHARACTER`.

Choosing a target is an explicit decision the player makes: `anEnemy("foe")` asks, then `chosen("foe")` uses the pick.
Never pick for the player.

```ts
definePackAbilities({
  "x.my-hero.06.query": whenRevealed(
    dealDamage(1, each(query("hero"))),
    ifThen(exists(query("minion", { trait: "ROBOT" as never })), surge()),
  ),
});
```

## Values and amounts

An amount is a number, or a computed value: `perHero(1)` ("1 per player"), `varOf("healed.amount")` (a number bound by
an earlier effect), `statOf(ref, "atk")`, `countOf(query)`, `countersOn(ref, type)`, `damageOn(ref)`, `threatOn(ref)`,
`handCountOf(player)`, `remainingHpOf(ref)`, `sum(a, b)`, `min(a, b)`, `max(a, b)`, `scaled(value, { times, plus, max })`,
`ifElse(predicate, a, b)`, `eventAmount` (the amount of the triggering event), `eventResult(key)`,
`taggedAbilitiesOn(tag)`, `zoneCountOf`, `refCount(chosen(slot))`.

## Predicates (conditions)

For `ifThen`, `{ while }`, `costIf` and limits: `isHero()`, `isAlterEgo()`, `inForm`, `exists(query)`, `inPlay("Exact Name")`,
`not(p)`, `allOf(a, b)`, `anyOf(a, b)`, `hasTrait(ref, trait)`, `isStunned`, `isConfused`, `valueAtLeast(a, b)`,
`valueAtMost`, `valueEquals`, `damagedAtLeast(ref, n)`, `threatAtLeast`, `varAtLeast(name, n?)`, `made(bind)`,
`eventDealt(key)`, `refMatches(ref, query)`, `playedThisTurn(query)`, `lastPlayedThisRound(query)`, `duringPlayerPhase`,
`canPayResources`, `attackInProgress`, `undefendedAttack`, `firstAttackThisTurn`.

## Lasting effects and rules

Effects that last: `modifyStat(stat, n, target, until)`, `gainKeywordUntil(keyword, target, until)`,
`gainTraitUntil`, `blankTextBoxUntil`, `blankTextBoxForPlayers(card, players, until)`, `applyRuleUntil(rule, until)`,
`reduceNextCardCost(player, n, "phase" | "round" | "turn", filter?)`, `increaseNextCardCost`, `afterNextCardPlayed`.
`until` is `"endOfPhase"`, `"endOfRound"`, `"endOfTurn"`, `"endOfAttack"`, `"endOfPlayerPhase"` or `"nextVillainPhaseBegins"`.
Rules (`rule({ kind: ... })`, or helpers such as `cannotMakeBasicAttacks`, `cannotFlip`, `reduceCostToPlay`,
`doesNotExhaustToDefend`) are the "cannot" and "may" statements.

## Constant abilities

Passed to `constant(...)`: `gets(stat, n, query, { while })`, `gainsKeyword(keyword, query)`, `losesKeyword`,
`gainsTrait`, `attacksGainKeywords([...], { attacker })`, `costModifier({ delta, appliesTo, activeIn, while })`,
`reduceCostToPlay`, `rule(...)`, `cannotThwart`, `cannotRecover`, `consideredToHaveResourceIcon`,
`playableTopOfDeck`, `takesFirstTurn`, `agile(x, query)` (a custom keyword some packs define), `statusLimit`, and many
more under "Constant abilities" in the generated reference.

```ts
definePackAbilities({
  "x.my-hero.11.constant": constant(
    gets("def", 1, YOUR_IDENTITY, { while: isHero() }),
    gainsKeyword({ name: "retaliate", value: 1 }, YOUR_IDENTITY),
    costModifier({ delta: -1, appliesTo: { self: true }, activeIn: "hand", while: duringPlayerPhase }),
  ),
});
```

## Encounter-side builders

For villains, schemes, minions and treacheries: `whenRevealed`, `whenDefeated`, `boost`, `setup`, `surge()`,
`placeThreat(perHero(n), self)`, `placeThreat(n, theMainScheme)`, `dealDamage(n, each(query("hero")))`,
`searchAndReveal(name)`, `discardEncounterCards`, `addAccelerationToken`, `swapVillain`, `advanceMainScheme`,
`cannotAttach` (the "if you cannot attach" half of "Attach to"), and the forced interrupts/responses above.

## Keywords are data, not builders

Printed keywords (Guard, Retaliate, Surge, Toughness, Uses, Hinder, ...) are entries in the card's `keywords`. A
script only reads or grants one: `gainsKeyword`, `gainKeywordUntil`, `attacksGainKeywords`, `withKeyword` in a query.

## When the DSL does not have it

If you cannot express a card's text with any builder in the generated reference, the engine does not have the
mechanic yet. Do not approximate it. See [AGENTS.md](../AGENTS.md): report it so the game can add the primitive, and
leave the ability unscripted. `npm run validate` also fails with `uses DSL feature "..." which this game version lacks`
if the pack uses something the installed SDK does not know (see [validation-errors.md](validation-errors.md)).

## Regenerating the generated reference

`dsl-reference-generated.md` is produced from the game repo by

```bash
node packages/mod-sdk/scripts/dsl-reference.mjs --out dsl-reference-generated.md
```

(in a clone of the [game repo](https://github.com/quincarter/marvel-champions-digital-game); the script scans
`packages/cards/src/dsl/*.ts`). Copy the output into `docs/` after each SDK release, so the reference matches the SDK
version your pack depends on. The header of the generated file says which SDK version produced it.
