# Plan 2 — Aldryon Game Models & Battle System

> Aldryon — A Text Based RPG.
> This plan describes the game domain: Player, Monster, Item, Attributes,
> Battles, and the battle API (start + attack), building on the bootstrap in
> [plan1.md](plan1.md). Same non-negotiables apply: Clean Architecture + DDD
> in `apps/api`, DTOs in `apps/shared/dtos`, testcontainers integration tests
> with the `usecase/` ≥ 75% coverage gate.

## 1. Goal

Model the core gameplay loop from the README:

- Players and monsters both have **Attributes** and fight **turn-based
  battles**; attacks cost **Stamina** and deal damage from the formulas in §6.
- Killing a monster grants **XP** (and drops items); dying costs the player
  **1% of XP**.
- A player can be in **at most one battle at a time** (DB-enforced).

## 2. Attributes (shared value object)

`Force, Dexterity, Agility, Intelligence, Vitality, Luck`

- All **integers**, **default 1**, and **can never go below 1**.
- Enforced twice, like `username` in plan1 §4b: in the domain
  (`Attributes.create()` rejects values < 1) and in DB `CHECK` constraints.
- **Stored inline on each owning row — NOT a separate `attributes` table.**
  Players, monsters, and items each carry their own six integer columns
  (`force, dexterity, agility, intelligence, vitality, luck`). No joins to
  read a fighter's stats.
- One domain value object `Attributes` reused by Player, Monster, and Item.
- Item attributes are **bonuses** and play by different rules than fighter
  attributes: they start at **0** and **can be negative** (typically −5 to
  +10 — cursed gear is allowed). A player's *effective* attributes =
  `max(1, base + sum of equipped item bonuses)` per attribute, computed in
  the domain and never stored — the ≥ 1 floor holds for the *fighter* even
  when items drag a stat down.

## 3. Domain Models & Schema

### 3a. Player (`players` table — 1:1 with `users`, deliberately separate)

**Not the same table as `users`.** `users` stays auth/profile only — the
on-screen `username`, email, avatar, isVip (plan1 §4b) — and may grow more
account-level concerns later; gameplay logic never mixes into it. `players`
is its own aggregate, **1:1 enforced by a `UNIQUE` FK to `users`**, created
on the player's first entry into the game. Attributes are inline per §2.
Everything gameplay-related (`player_items`, `battles`) references
`players.id`, never `users.id`.

| Field        | Type / rule                                                                                                         |
| ------------ |---------------------------------------------------------------------------------------------------------------------|
| `id`         | UUIDv7 (usecase layer, `Bun.randomUUIDv7()` — plan1 §4b)                                                            |
| `user_id`    | FK → users, not null, **`UNIQUE`** — the 1:1 link                                                                   |
| `gold`       | integer, not null, default 0, `CHECK (gold >= 0)`                                                                   |
| `level`      | integer, not null, default 1, `CHECK (level >= 1)`                                                                  |
| `xp`         | integer, not null, default 0, `CHECK (xp >= 0 AND xp <= 1000000)` — hard **XP cap at 1 million** (§6b)              |
| `attribute_points` | integer, not null, **default 10** — a new player starts with 10 points to spend; grows on level-up (§6b). `CHECK (>= 0)` |
| max HP       | **not a column — computed**: `100 + 10 × Vitality + 1 × Force` (effective values, so gear moves it). Every player starts at 100 + their attribute contribution. Current HP during a battle lives in `battles`. This is Vitality's formula (and Force's second job). |
| max Stamina  | **not a column — computed**: `5 × level`, i.e. **+5 per level**, reaching the hard **cap of 100 at max level 20**. Current Stamina during a battle lives in `battles`. |
| attributes   | six integer columns, not null, default 1, `CHECK (x >= 1)`                                                          |
| `last_death_at` | `timestamptz`, nullable — set on every death, **stored in UTC**; the API returns it as ISO-8601 UTC and the front-end converts it to the browser's timezone. The player always knows exactly when they last died. |
| `last_run_at` | `timestamptz`, nullable — set when the player flees (§5b); drives the run cooldown in §4 |
| `pending_loot` | `JSONB` array of itemIds, default `[]` — the kill's drop offer awaiting the player's pick (§5e); forfeited on the next `/battle/start` |
| items        | via `player_items` (see 3d) — instances, not inline, because items are catalog entities referenced by id from drops |

### 3b. Item (`items` table — the catalog)

| Field        | Type / rule                                              |
| ------------ | -------------------------------------------------------- |
| `id`         | UUIDv7 (usecase layer, `Bun.randomUUIDv7()` — plan1 §4b) |
| `name`       | text, not null, unique                                   |
| `description`| text, not null                                           |
| `value`      | integer, not null, `CHECK (value >= 0)` — gold value     |
| `rarity`     | Postgres `ENUM item_rarity` (`common, uncommon, rare, epic, legendary`) |
| `slot`       | `ENUM equipment_slot` (`helmet, body, boots, gloves, necklace, weapon, two_handed_weapon`), **nullable** — null = not equippable (consumables/quest items for the README "Bag" action) |
| attributes   | six integer columns — the **bonus** the item grants when equipped. Default **0**, **may be negative**, no ≥ 1 CHECK (that rule is for fighters). Typical range −5..+10 — validated as a soft rule at the seeding boundary, not a DB constraint. Effective fighter attributes clamp at 1 in the domain (§2). |
| `hp_restore` | integer, **nullable**, `CHECK (hp_restore > 0)` when set — consumables like **POTs**: using one via `/battle/bag` (§5c) restores this much HP (capped at max). Each POT carries its own value — small/large pots are seed data, not code. |

### 3c. Monster (`monsters` table — the catalog)

| Field            | Type / rule                                          |
| ---------------- | ---------------------------------------------------- |
| `id`             | UUIDv7 (usecase layer)                               |
| `name`           | text, not null, unique                               |
| `description`    | text, not null                                       |
| `region`         | Postgres `ENUM monster_region` (`mountain, forest, dungeon, bandit, sewage`), not null, indexed — battle start filters by it. Adding a region = one enum migration. |
| `monster_image`  | text, not null, **unique** — CDN URL of the monster's PNG, one per monster; shipped to the client in the battle-start response |
| `hp`             | integer, not null, `CHECK (hp >= 1)` — max HP        |
| `xp_gain`        | integer, not null, `CHECK (xp_gain >= 0)` — awarded on kill |
| attributes       | six integer columns, not null, default 1, `CHECK (x >= 1)` |
| `drops`          | `JSONB` array of `{ itemId, dropRate }` tuples       |
| `exclusive_drops`| `JSONB` array of `{ itemId, dropRate }` — items only this monster drops |
| `ambush_chance`  | integer, not null, default 0, `CHECK (0..100)` — % chance the monster **attacks instantly on encounter** ("you tripped or bumped into it", §4) |

- Drop tuples stay **inline on the monster row** (JSONB), matching the
  "arrays of (item_id, drop_rate) tuples" model — no drops join table. Shape
  is validated by the domain (`dropRate` ∈ (0, 100]) and by a Zod schema at
  the seeding/admin boundary; referential integrity to `items` is checked in
  the usecase when drops are rolled (a dangling itemId logs + skips, never
  crashes a battle).
- **A kill drops at most ONE item per pool** — one from `drops` **and** one
  from `exclusive_drops`, rolled independently. Within a pool each tuple
  rolls its own `dropRate`; if several succeed, one winner is picked at
  random among them (proposal — see §10). The dropped items become a
  numbered **loot offer** the player picks from (§5e), not an automatic
  bag insert.

### 3d. Player inventory & equipment (`player_items`)

| Field       | Type / rule                                               |
| ----------- | --------------------------------------------------------- |
| `id`        | UUIDv7                                                    |
| `player_id` | FK → players                                              |
| `item_id`   | FK → items                                                |
| `equipped_slot` | `ENUM equipment_slot`, **nullable** — null = in the bag |
| `quantity`  | integer, not null, default 1, `CHECK (quantity BETWEEN 1 AND 5)` — consumables **stack up to 5** per row/slot; gear is always quantity 1 |

**Bag capacity** (enforced by the domain `Bag` aggregate — equipped items
don't count):

- **20 slots** for unequipped item stacks — **25 if `users.isVip`** (the
  VIP flag's second gameplay use).
- **Bandages and antidotes do NOT use those slots**: each has its own
  dedicated **special slot** outside the capacity, holding **up to 5 of
  each**.
- **POTs stack the same way (max 5 per stack) but their stacks occupy the
  normal 20/25 slots.**
- One `player_items` row = one slot (a stack); using a consumable
  decrements `quantity`, deleting the row at 0.

- Two enums, because an item's *kind* and its *placement* differ for
  weapons:
  - `item_slot` (on `items.slot`): `helmet, body, boots, gloves, necklace,
    weapon, two_handed_weapon` — what the item can occupy.
  - `equipment_position` (on `player_items.equipped_slot`): `helmet, body,
    boots, gloves, necklace, weapon_1, weapon_2` — the physical slots. A
    `weapon` item fits either hand.
- **Max ONE equipped item per position** (Helmet, Body, Boots, Gloves,
  Necklace, Weapon1, Weapon2): partial unique index
  `UNIQUE (player_id, equipped_slot) WHERE equipped_slot IS NOT NULL`.
- **Two-handed weapons use both hands:** stored as equipped in `weapon_1`,
  with the domain rule that a two-handed weapon requires **both** hands
  empty, and nothing can equip into `weapon_2` while one is held. Domain
  `Equipment.equip()` is the single place these rules live.

### 3e. Player Attack (`attacks` table — the player catalog)

**Player attacks and monster attacks are different things and live in
separate tables** — player attacks carry player-gating (level/attribute
requirements) that makes no sense for monsters, and monster attacks carry
special-attack mechanics (§3f) that players don't have. Player attacks are
back-end data sent to the client at battle start (§5):

**Every attack is DB seed data, tuned later in the DB — never hardcoded.**
Both players and monsters **always have `HIT`**: a free fallback attack,
`stamina_cost = 0`, `multiplier = 0.4` (≈40% of a normal strike). It's a
regular row in each table, present in every moveset, so nobody is ever
locked out of acting.

| Field          | Type / rule                                            |
| -------------- | ------------------------------------------------------ |
| `name`         | text, **unique** — the key the client POSTs back       |
| `stamina_cost` | integer, not null, `CHECK (stamina_cost >= 0)` — 0 only for `HIT`-style free attacks |
| `multiplier`   | numeric, not null — **one multiplier per attack, the same value offensively and defensively** (§6) |
| `scaling_attribute` | `ENUM attack_scaling` (`force, intelligence`) — the attribute the multiplier applies to: physical attacks scale with Force, magical with Intelligence. Same mechanic for players and monsters. |
| `applies_effect` | `ENUM battle_effect_kind` (`bleed, poison, burn`), **nullable** — attacks flagged with this can proc the effect on hit (§6a). On the player side there is exactly ONE such attack: the over-time **fire spell** (`burn`). |
| `counter_item_id` | **FK → items**, nullable — the item that cures the applied effect (e.g. `bandage` for bleed, `antidote` for poison), guaranteed by the FK to be an item that already exists. The `CHECK ((applies_effect IS NULL) = (counter_item_id IS NULL))` lives on **`monster_attacks`** (§3f) — player-inflicted `burn` has no counter because monsters have no bag (§6a). |
| `min_level`    | integer, default 1 — level requirement                 |
| attribute requirements | six integer columns, default 1 — minimum effective attributes to use it |

### 3f. Monster Attack (`monster_attacks` table + `monster_movesets` join)

Monster attacks share the combat columns (`name` unique, `stamina_cost`,
`multiplier`, `scaling_attribute`, `applies_effect`, `counter_item_id` —
same CHECK as §3e) but have **no level/attribute requirements** (a monster's
moveset is just whatever it's given) and add the special-attack mechanics:

| Field          | Type / rule                                             |
| -------------- | ------------------------------------------------------- |
| `is_special`   | boolean, not null, default false                        |
| `charge_turns` | integer, not null, default 0, `CHECK (charge_turns >= 1 OR NOT is_special)` — **specials need at least one turn of rest to charge** |

- `monster_movesets` (monster_id FK, monster_attack_id FK) lists each
  monster's moveset; common attacks (bite, claw) are shared across monsters,
  and **some monsters get special attacks** via the same join.
- **Special attacks (`is_special`):**
  - The monster must first spend `charge_turns` (≥ 1) turns **resting to
    charge** — it doesn't strike, and recovers stamina like a rest. The
    charging state lives on the battle row (§3h).
  - While the monster charges, the turn report carries a **warning notice**
    for the player, picked from a back-end flavor pool: *"The monster is
    preparing something…"*, *"The monster is channeling…"*, *"The monster
    stopped and is glowing, be careful…"*.
  - On the monster's next turn it **unleashes the special — a charged
    special always goes: no hit check, no proc roll.** Its
    `applies_effect` (over-time or debuff) lands with **100% chance**, and
    its `multiplier` is typically far above normal attacks — though **some
    specials do no damage at all** (`multiplier ≈ 0`) and exist purely for
    the guaranteed debuff. Either way a special **burns a lot of monster
    stamina** (high `stamina_cost` — data, not a code path).

### 3g. Level curve (`levels` table — the XP-per-level catalog)

The XP scaling by level is **its own table**, so the curve is game data set
in the DB (seeded, and tunable there without a deploy) — not a formula
hardcoded in the app:

| Field         | Type / rule                                              |
| ------------- | -------------------------------------------------------- |
| `level`       | integer, **primary key**, `CHECK (level >= 1)`           |
| `xp_required` | integer, not null, unique — **total** XP needed to reach this level, `CHECK (xp_required >= 0 AND xp_required <= 1000000)` |

- Level 1 = 0 XP; **max level is 20 (for now)** — level 20's `xp_required`
  = the 1,000,000 cap, so the table seeds exactly 20 rows.
- Seed data generates the exponential curve of §6b; after that the table is
  the source of truth. A player's level is derived: the highest `level`
  whose `xp_required <= xp` (recomputed on every XP change, up on kills and
  down on the death penalty).

### 3h. Battle (`battles` table — the only new *stateful* table)

| Field                    | Type / rule                                  |
| ------------------------ | -------------------------------------------- |
| `id`                     | UUIDv7                                       |
| `player_id`              | FK → players, **`UNIQUE`** — a player battles at most one monster at a time; the constraint IS the business rule |
| `monster_id`             | FK → monsters                                |
| `player_current_hp`      | integer, not null, `CHECK (>= 0)`            |
| `player_current_stamina` | integer, not null, `CHECK (>= 0)`            |
| `monster_current_hp`     | integer, not null, `CHECK (>= 0)`            |
| `monster_current_stamina`| integer, not null, `CHECK (>= 0)`            |
| `round`                  | integer, not null, default 1 — effects tick per round (§6a) |
| `player_effects`         | `JSONB` array of active effects on the player (§6a), default `[]` |
| `monster_effects`        | `JSONB` array of active effects on the monster, default `[]` |
| `monster_charging_attack_id` | FK → monster_attacks, **nullable** — set while the monster charges a special (§3f); `charge_rounds_left` integer counts down. Both null/0 when not charging. |

- The `_Status` pairs (Current_HP, Current_Stamina) are plain columns on the
  battle row — no separate status table.
- A battle row exists **only while the battle is live**: created by battle
  start, **deleted** when it ends (kill, death, or flee). The plain
  `UNIQUE (player_id)` then enforces one-battle-per-player with no partial
  index or state flag. Battle *history* is out of scope here (future table if
  wanted).

## 4. API — Battle Start

`POST /battle/start` `{ region }` (authenticated; `region` is the
`monster_region` enum — the Zod DTO rejects anything else):

1. Reject if the player already has a `battles` row (409 — the unique
   constraint backs this up against races).
1a. **Run cooldown:** if the player fled recently (`last_run_at`), reject
   (429 with the seconds remaining) until **30 seconds** have passed —
   **15 seconds if `users.isVip`** (the first gameplay use of the VIP flag;
   it stays on `users`, read via the 1:1 join). Constants in domain config.
   **Dying has NO cooldown** — you already paid the 1% XP (§6b), so you can
   battle again immediately.
2. **20% of the time: find nothing.** Return an "empty battle" — no row
   created, `monster: null`, plus a flavor sentence ("You wander the moors of
   Aldryon and find only wind…"). Sentence pool lives in the back-end.
3. Otherwise pick a **random monster of that region** and insert the battle
   row with both sides at max HP/Stamina.
4. **Ambush roll:** roll against the monster's `ambush_chance` — on success
   the monster **attacks instantly** (one free strike resolved with the
   normal §6 math, effect procs included) before the player ever acts,
   with a narrative line ("You trip and stumble right into it…"). An ambush
   can't use a special (those need charging).
5. Return:
   - the monster (name, description, `monster_image` CDN URL, HP,
     attributes — what the UI shows),
   - both statuses (already reflecting an ambush strike, plus the ambush
     report if one happened),
   - **the player's available attacks**, each with `name`, `staminaCost`,
     and its attribute/level **requirements** — sent up-front at battle start
     so the client can render/grey them out without another round trip.

All request/response shapes are Zod schemas in `apps/shared/dtos`.

## 5. API — Battle Actions

Four actions, mirroring the README battle menu, all authenticated POSTs:
**`/battle/attack`**, **`/battle/run`**, **`/battle/bag`**, **`/battle/rest`**.
Every action consumes the player's turn: the monster's reply (step 4 below),
the effect ticks (step 5), and the settlement/report (steps 6–7) run for all
of them — except a run that succeeds, which ends the battle instead. All
four 404 if the player has no live battle.

**Stamina economy:** both sides passively recover **5 Stamina** at the end
of every round; choosing **Rest recovers 15 instead of the normal 5**. A
monster's rest (nothing affordable) and charge turns (§3f) use the same 15.
Constants live in domain config, not scattered literals.

### 5a. `POST /battle/attack` `{ attackName }`

1. 400 if `attackName` doesn't exist in
   the catalog (name is unique — it's the identifier).
2. Verify the player **has the Stamina** for it (`player_current_stamina >=
   stamina_cost`), 400 otherwise. (Requirements were already shipped at
   battle start; stamina is the server-side check the user story requires —
   level/attribute requirement re-checks also happen here since the client
   can't be trusted.)
3. Resolve the **player's strike** on the monster (§6), spending the
   stamina; on a hit with a flagged attack, roll the effect proc (§6a).
4. If the monster survives, resolve the **monster's turn**:
   - **Charging?** (`monster_charging_attack_id` set): decrement
     `charge_rounds_left`; if still > 0, keep charging (another warning
     notice, stamina recovers). If it hits 0, **unleash the special — it
     always goes** (§3f): no hit check, damage from its multiplier (which
     may be ≈ 0 for pure-debuff specials), effect at **100%, no proc
     roll**, and a hefty stamina spend.
   - **Not charging:** pick an attack from the moveset it can afford
     (same reverse §6 logic, effect procs included). If it picks a
     **special**, this turn becomes the charge turn: it rests (recovering
     stamina), the charging state is written to the battle row, and the
     turn report carries the **warning notice** from the flavor pool.
     If it can't afford anything, it rests — mirroring the README's Rest
     action.
5. **Tick active effects** (§6a): DoT damage on both sides, debuff
   `roundsLeft` decrements, `round` increments.
6. Persist the new statuses; if the monster died: delete the battle row,
   award `xp_gain` (+ level-ups and attribute points, §6b), roll the drops
   (§3c: at most one per pool) into `players.pending_loot`, and include the
   numbered **loot offer** in the report — the player picks what to keep
   via §5e. If the player died: delete the battle row, apply the death rule
   — **lose 1% of total XP** (§6b) — and stamp `players.last_death_at`
   (UTC). No cooldown: the player may start a new battle immediately.
7. Return a turn report DTO: hit/miss per side, damage numbers, effect
   procs/ticks, both statuses, and battle outcome (`ongoing | won | lost |
   fled`) — the text UI narrates from this.

### 5b. `POST /battle/run`

Try to flee — **might take the extra hit** (README: the monster can get a
free attack on you as you go):

1. Parting-hit check — a straight **Agility comparison, no roll**: if the
   monster's Agility is **greater than** the player's effective Agility,
   the monster lands **one free strike** (normal §6 math, effect procs
   included) as you turn your back; otherwise you get away clean. This is
   Agility's formula — outrun it or bleed for it.
2. If the player survives (or was never hit), the battle **ends as `fled`**:
   row deleted, no XP, no drops, no death penalty — but `last_run_at` is
   stamped, starting the 30s/15s-VIP cooldown before the next
   `/battle/start` (§4 step 1a). If the parting hit kills the player, the
   normal death settlement runs (−1% XP, no cooldown).

### 5c. `POST /battle/bag` `{ playerItemId }`

Use a consumable from the bag — **POTs** (HP regen), **Bandage**,
**Antidote**:

1. 400 if the `player_items` row isn't the player's, is equipped gear, or
   has no consumable use (no `hp_restore` and doesn't match any active
   effect's `counterItemId`).
2. Apply the item:
   - **POT** (`hp_restore` set): restore that HP, capped at max HP;
   - **counter item**: remove the matching over-time effect (§6a) — a
     `bandage` ends bleed, an `antidote` ends poison, purely by
     `counterItemId` comparison.
3. The item is **consumed** — `quantity` decrements; the `player_items`
   row is deleted when the stack hits 0 (§3d).
4. Using an item takes the turn: monster reply + ticks follow (steps 4–7).

### 5d. `POST /battle/rest`

1. Recover **15 Stamina** (instead of the passive 5), capped at max.
2. Resting takes the turn: monster reply + ticks follow (steps 4–7) — rest
   under pressure is a gamble, exactly as the README intends.

### 5e. `POST /battle/loot` `{ picks }` — claim the kill's drops

The win report numbers the dropped items (the UI shows buttons or plain
`1 2 3` text input); the player **chooses what to keep**:

1. 400 if `pending_loot` is empty or a pick isn't in it.
2. Each picked item is added to the bag under the §3d rules (stacking,
   capacity, special slots) — a pick that doesn't fit is rejected with the
   reason, the rest still land.
3. Claimed picks are removed from `pending_loot`; the player may decline
   the rest (or just walk away — **starting the next battle forfeits
   whatever is still unclaimed**).

## 6. Combat Math (domain services, pure — unit-testable)

Both directions (player→monster, monster→player) run the exact same
functions with attacker/defender swapped. "Attributes" here means
**effective** attributes (base + equipped item bonuses) for the player,
base attributes for the monster.

**Hit check:**

```
HitChance = (AttackerDexterity / DefenderDexterity) * 100 + AttackerLuck
```

- If `HitChance > 100` → guaranteed **hit**.
- Else roll `Hit = random integer in [20, 100]`;
  `Hit <= HitChance` → **hit**, `Hit > HitChance` → **0 damage** (miss).

**Damage (on hit):**

```
attack_value(side)  = attack.multiplier * effective(attack.scaling_attribute)
                      // Force for physical attacks, Intelligence for magical

Damage = (attack_value(attacker) * stamina_cost + attacker_level)
       - (attack_value(defender) + defender_level)
```

- **One multiplier per attack, used identically on offense and defense** —
  a side's defensive term reuses the multiplier (and scaling attribute) of
  its own current attack, representing its fighting stance. First round
  before a side has attacked: its stance is its default/first moveset entry.
- **Zero-cost attacks (`HIT`, §3e):** the damage term uses
  `max(1, stamina_cost)` so a free attack still lands
  `0.4 × scaling attribute × 1 + level` instead of collapsing to the bare
  level difference (proposal — see §10).
- This is how Force and Intelligence enter combat: the attack's
  `scaling_attribute` picks which of the two the multiplier applies to,
  the same way for players and monsters.
- **Clamp at 0** — the subtraction can go negative and damage never heals.
- Randomness is injected (an `Rng` port) so unit tests are deterministic and
  the 20% empty-encounter, hit rolls, and effect procs are testable.

## 6a. Battle Effects (debuffs & damage over time)

Extra effects that ride on attacks flagged `applies_effect`:

- **Proc roll (attacker-side):** on a successful hit with a flagged attack,
  roll `random integer in [20, 100]`; if `roll <= attacker's effective Luck`
  the effect is applied to the defender. **Exception: a monster's charged
  special (§3f) skips the roll — its effect lands with 100% chance on hit.**
- **Effect shapes** (stored in the battle row's `player_effects` /
  `monster_effects` JSONB, ticked every round after the attack exchange):
  - **Damage over time** (`bleed`, `poison`, `burn`): deals damage per
    round *in addition to* attack damage. **The magnitude is computed, not
    a column** — snapshotted into the effect entry when it's applied:

    ```
    damagePerRound = (inflictor_level + 2) - (victim_level)
    ```

    Monster poisons/bleeds the player: `(monster_level + 2) − player_level`.
    The contrary direction is the player's **over-time fire spell** —
    the ONLY player attack that applies a DoT (`burn`), same formula
    reversed: `(player_level + 2) − monster_level`. Clamped at a minimum
    of 1 so an applied effect always ticks (proposal — see §10).
    **No fixed duration** — it lasts until cured or the battle ends.
    **Every monster-inflicted over-time effect carries a `counterItemId`**
    — the id of the one item that cures it, copied from the applying
    attack's `counter_item_id` (a real FK to `items`, so the counter is
    always an item that exists in the game):
    - `bleed`'s counter item is the **`bandage`**, `poison`'s the
      **`antidote`** — but that's seed data, not code: cure logic only ever
      compares against the effect's `counterItemId`, so new DoT effects
      need no new code;
    - consuming the counter item via `POST /battle/bag` (§5c) removes the
      effect;
    - if the player doesn't have the counter item, the effect stays until
      the end of the battle;
    - the player's `burn` on a monster has **no counter** — monsters have
      no bag, so it always lasts until the battle ends. The
      `counter_item_id` CHECK therefore applies to `monster_attacks` only;
      on the player `attacks` table it stays null for the fire spell.
  - **Debuffs**: temporarily lower one stat/attribute of the target for N
    rounds (`{ kind: "debuff", stat, amount, roundsLeft }`), decrementing
    each round and expiring at 0. Applied to *effective* values in the
    domain — never written to the base columns.
- DoT can kill: the same death/kill settlement of §5 applies when a tick
  brings HP to 0.

## 6b. XP, Level Curve & Attribute Points

- **XP cap: 1,000,000** — hard-stopped in the domain and by the DB CHECK.
- **Death penalty:** dying costs **1% of total XP** (`xp = floor(xp * 0.99)`),
  which can de-level the player if it crosses a `levels` threshold downward.
- **The curve lives in the `levels` table (§3g)**, consulted through a
  `LevelRepository` port. The seed generates an exponential curve topping
  out at the cap: with **max level L = 20 (decided, for now)**,
  `xp_required(level) = ceil(1_000_000 * (growth^(level-1) - 1) /
  (growth^(L-1) - 1))`, growth tuned so early levels are quick and the last
  ones brutal (proposed `growth = 1.1`). That formula only exists in the
  seeder — the game reads the table. Leveling also raises **max Stamina by
  +5 per level** (§3a: `5 × level`, capped at 100 at level 20).
- **Each level-up grants X attribute points** for the player to spend on any
  of the six attributes — **X comes from ENV `LEVEL_UP_ATTRIBUTE_POINTS`,
  default 4** (read in `infrastructure/`, passed into the usecase as config;
  the domain never touches `process.env`). A **new player starts with 10
  points** (`players.attribute_points` default).
- Points accumulate in `players.attribute_points` and are spent via
  `POST /player/attributes` (`AllocateAttributePointsUseCase`): validates the
  player has the points, increments base attributes (which only ever go up —
  the ≥ 1 floor can't be violated here), decrements the pool. Monsters don't
  level; their attributes are fixed catalog data.

## 7. Clean Architecture Mapping

- `domain/` — `Attributes` VO, `Player` (its **own aggregate**, 1:1 with the
  existing `User` — auth/profile stays in `User`, untouched by gameplay),
  `Monster`, `Item`, `Equipment` (slot rules incl. two-handed), `Bag`
  (capacity 20/25-VIP, stacks of 5, special bandage/antidote slots),
  `Battle`, and pure combat services (`HitCheck`, `DamageCalculator`,
  `EffectResolver`). No I/O.
- `usecase/` — `StartBattleUseCase`, `AttackUseCase`, `RunFromBattleUseCase`,
  `UseBagItemUseCase`, `RestUseCase`, `ClaimLootUseCase`, `EquipItemUseCase`
  (slot/two-handed rules), `AllocateAttributePointsUseCase`, behind ports:
  `PlayerRepository` (new, separate from today's `UserRepository`),
  `MonsterRepository`, `ItemRepository`, `BattleRepository`,
  `AttackRepository` (player attacks), `MonsterAttackRepository` (§3f
  movesets + specials), `LevelRepository` (the §3g curve), `Rng`. **All
  under the ≥ 75% integration-coverage gate.**
- `infrastructure/` — Postgres implementations (Bun.SQL, direct — no
  PostgREST, per plan1), migrations for the new tables/enums/constraints,
  seed data (monsters, items, attacks). **Required seeds:** the `HIT`
  attack in both attack tables (0 stamina, ×0.4); the player's **`BURN
  SPELL`** — the one player DoT (`applies_effect = burn`, scaling
  Intelligence, no counter item) — requiring **≥ 50 Intelligence** and
  costing **50 Stamina** (affordable from level 10, since max Stamina is
  5 × level); items **`bandage`** and **`antidote`** (UUIDv7 ids,
  `value = 50` gold each, common rarity, not equippable); at least one POT
  with its `hp_restore`; the 20-row `levels` curve. A **store** (buy POTs
  of various sizes / sell drops, every price a DB `value`) is a plan3
  feature — the `value` column already carries the prices.
- `interface/` — Hono routes `POST /battle/start`, `POST /battle/attack`,
  `POST /battle/run`, `POST /battle/bag`, `POST /battle/rest`,
  `POST /battle/loot`, mapping to/from `apps/shared/dtos` Zod schemas.

## 8. Testing

- **Unit:** combat math (hit chance boundaries — exactly 100, roll edges 20
  and 100, damage clamped at 0, Force vs Intelligence scaling, zero-cost
  `HIT` via `max(1, stamina_cost)`, max HP = 100 + 10×Vit + 1×For,
  max Stamina = 5×level capped at 100, charged specials skipping the hit
  check), `Attributes`
  floor of 1 (including negative item bonuses clamping effective values at
  1), equipment slot rules (two-handed occupying both hands), drop-rate
  validation, effect procs (roll vs Luck boundaries; specials bypassing the
  roll), the charge state machine (charge → notice → unleash; charging
  counts as rest), DoT ticks and debuff expiry, the level curve (thresholds,
  cap at 1M, 1% death penalty, points-per-level from config).
- **Integration (testcontainers, drives the coverage gate):**
  - battle start happy path (row created, attacks listed with requirements),
  - the 20% empty encounter (seeded Rng),
  - one-battle-per-player constraint (second start → 409, DB unique holds),
  - attack happy path (stamina spent, damage applied, statuses persisted),
  - unknown attack name / not-enough-stamina rejections (incl. `BURN
    SPELL` gated behind 50 Intelligence / 50 Stamina),
  - kill flow (XP awarded incl. level-up + attribute points, drops rolled —
    at most one per pool, independently — into `pending_loot`, battle row
    gone),
  - loot claim (numbered picks land in the bag under capacity rules;
    non-fitting pick rejected; unclaimed loot forfeited by the next battle
    start),
  - death flow (1% total-XP loss, battle row gone),
  - effect flow (proc persisted in the battle row, DoT tick applied on the
    next turn, bleed/poison surviving until battle end without the cure
    item),
  - ambush start (seeded Rng: free monster strike reflected in the battle
    row and the start response),
  - special attack flow (charge state persisted + warning notice returned,
    next turn unleashes with the effect at 100%),
  - run flow (clean escape when player Agility ≥ monster's; parting hit
    lands when the monster is faster; a fatal parting hit triggers the
    death settlement),
  - run cooldown (start within 30s of a flee → 429; 15s window for a VIP
    user; death → immediate restart allowed, `last_death_at` stamped in
    UTC),
  - DoT magnitude ((level + 2) − level snapshot, min 1, both directions),
  - bag flow (POT heals capped at max HP; bandage removes bleed; stack
    decremented and row deleted at 0; useless/foreign item rejected),
  - bag capacity (21st stack rejected for a normal user, accepted for VIP
    up to 25; bandage/antidote sit in special slots without consuming
    capacity; stacking past 5 rejected),
  - rest flow (+15 stamina capped at max, monster still gets its turn),
  - attribute point allocation (spend happy path, overspend rejected).

## 9. Implementation Order

1. Migrations + enums (`item_rarity`, `item_slot`, `equipment_position`,
   `attack_scaling`, `battle_effect_kind`, `monster_region`); new tables
   `players` (1:1 with
   `users`), `items`, `monsters` (incl. `ambush_chance`), `player_items`,
   `attacks` (player), `monster_attacks` + `monster_movesets` (incl.
   specials), `levels` (+ exponential seed), `battles` (+ unique player_id,
   + charging state). `users` is NOT touched.
2. `Attributes` VO + extended `Player` domain + `Monster`/`Item`/`Battle`
   entities, combat services with injected `Rng`.
3. Repos (ports in `usecase/`, Postgres impls in `infrastructure/`) + seeds.
4. `StartBattleUseCase` + route + DTOs.
5. `AttackUseCase` (full turn incl. monster reply, kill/death settlement) +
   route + DTOs.
6. `RunFromBattleUseCase`, `UseBagItemUseCase`, `RestUseCase`,
   `ClaimLootUseCase` + routes + DTOs (§5b–5e).
7. `EquipItemUseCase` + slot rules.
8. Tests per §8 throughout; every step keeps Biome + pre-commit gates green.

## 10. Decisions & Open Questions

**Decided:**
- **`players` is its own table, 1:1 with `users`** (`UNIQUE` FK). `users`
  stays auth/profile (on-screen username, email, avatar, isVip) and can grow
  account-level features later; gameplay never mixes into it.
- Attributes inline as six integer columns on each owner — no attributes
  table, no JSONB for stats (CHECK constraints beat schemaless here).
- Drops inline on the monster as JSONB tuple arrays; `dropRate` is a percent
  in (0, 100].
- Item attribute bonuses start at **0 and may be negative** (typically
  −5..+10); fighter attributes keep the ≥ 1 floor, with effective values
  clamped at 1 in the domain.
- Every attack has **one multiplier used for both attack and defense**, plus
  a `scaling_attribute` — Force (physical) or Intelligence (magical) — the
  same mechanic for players and monsters. This resolves the earlier open
  questions about the defender's multiplier and about Force/Intelligence
  being unused.
- **XP cap 1,000,000**; death = −1% of total XP; **the level curve is its
  own `levels` table** (total XP per level, seeded exponentially, tunable in
  the DB). Each level-up grants `LEVEL_UP_ATTRIBUTE_POINTS` (ENV, default 4)
  points; **new players start with 10 points**.
- Battle effects (bleed/poison DoT + timed debuffs) live in JSONB on the
  battle row; proc = roll [20,100] ≤ Luck on attacks flagged for the effect.
  **Every over-time effect carries a `counterItemId`** — an FK-backed
  reference to the one existing item that cures it (`bandage` for bleed,
  `antidote` for poison, as seed data); without it the effect lasts until
  the battle ends.
- **Player attacks and monster attacks are separate tables** (`attacks` vs
  `monster_attacks` + `monster_movesets`): player attacks carry gating
  requirements, monster attacks carry special mechanics. No shared catalog.
- **Special monster attacks** (`is_special`, `charge_turns >= 1`): the
  monster rests ≥ 1 turn to charge (player gets a warning notice from a
  flavor pool), then unleashes — **a charged special always goes** (no hit
  check), effect lands at **100%** (no proc roll), multipliers can be far
  above normal or ≈ 0 for pure-debuff specials, and the stamina cost is
  high. Charging state lives on the battle row.
- **`HIT` for everyone:** both attack tables seed a free `HIT` attack —
  0 stamina, multiplier 0.4 (≈40% damage) — so player and monster can
  always act. All attacks are DB seed data, tuned later in the DB.
- **Max HP formula:** `100 + 10 × Vitality + 1 × Force` (effective),
  computed in the domain — no stored max-HP column on `players`. Vitality's
  formula, resolved.
- **Max Stamina formula:** `5 × level`, **+5 per level, hard cap 100** —
  reached exactly at **max level 20 (for now)**. Computed, not stored.
- **`BURN SPELL` seed:** the player's single DoT attack — needs
  **≥ 50 Intelligence**, costs **50 Stamina**, applies `burn`
  (Intelligence-scaled, no counter item). Like every attack, it's DB seed
  data to tune later.
- **Drop settlement:** `drops` and `exclusive_drops` roll **independently**,
  **at most one item per pool** per kill. Drops are a numbered **loot
  offer** (`players.pending_loot`) — the player picks what to keep via
  `POST /battle/loot` (§5e); unclaimed loot is forfeited on the next battle
  start. No automatic bag inserts.
- **Run parting hit is deterministic:** the monster gets its free strike
  **iff its Agility is greater than the player's effective Agility** — no
  roll. Agility's formula, resolved.
- **Special bag slots: exactly 2** (bandage + antidote) — "3" was a typo.
- **Seed items:** `bandage` and `antidote` exist from day one — UUIDv7 ids,
  **50 gold** each. A buy/sell **store** (incl. POT sizes, all prices from
  the DB `value` column) is deferred to plan3.
- **Bag size:** 20 stack-slots (**25 for VIP**). Consumables stack up to
  **5 per slot** (`player_items.quantity`); bandages and antidotes each get
  a dedicated special slot **outside** the capacity (max 5 each); POT
  stacks use the normal slots. Equipped gear never counts.
- **Ambush:** `monsters.ambush_chance` % — on encounter the monster may get
  one instant free strike ("you tripped into it"), resolved with normal
  combat math at battle start; never a special.
- **`region` is a Postgres enum** (`monster_region`): `mountain, forest,
  dungeon, bandit, sewage` for now — new regions are an enum migration.
  (Closes the old free-text-vs-enum open question.)
- **`monster_image`**: every monster has a unique CDN PNG URL, sent to the
  client in the battle-start response.
- **Four battle actions** (§5): `/battle/attack`, `/battle/run` (may take a
  parting hit), `/battle/bag` (POTs restore their own `hp_restore` HP;
  bandage/antidote cure by `counterItemId`; item consumed), `/battle/rest`
  (**+15 Stamina vs the passive +5/round** both sides get; monster rest and
  charge turns also +15). Every action costs the turn.
- **Run cooldown:** fleeing stamps `players.last_run_at`; a new battle is
  blocked for **30s (15s for VIP)** — first gameplay use of `users.isVip`.
  **Death has no cooldown** (the 1% XP loss is the price); every death
  stamps `players.last_death_at` in **UTC**, exposed as ISO-8601 for the
  front-end to render in the browser's timezone.
- **DoT magnitude is computed, not stored:**
  `damagePerRound = (inflictor_level + 2) − victim_level`, snapshotted into
  the effect on application. The player owns exactly ONE DoT attack — the
  fire spell (`burn`, no counter item since monsters have no bag); monster
  DoTs (bleed/poison) use the same formula in their direction. (Closes the
  old `damage_per_round` column question.)
- One live battle per player = `UNIQUE (player_id)` on `battles`, rows
  deleted at battle end. History deferred.
- Attack identity is its unique `name` — that's what `POST /battle/attack`
  receives.
- Empty-encounter chance: 20%, decided server-side via the injected `Rng`.

**Open:**
- **How the monster picks its move:** proposed uniform random among moveset
  entries it can afford (specials included — picking one starts the
  charge). If specials should be rarer/smarter (e.g. weight by remaining
  HP), that's an AI tweak for later.
- **Zero-cost damage term:** with `stamina_cost = 0`, the §6 damage formula
  would zero out `HIT`'s attack value, so the term uses
  `max(1, stamina_cost)`. Confirm that's the intended reading of "40% of
  the normal damage".
- **Effect proc Luck side:** proposed as the *attacker's* Luck (higher Luck
  → more procs). If the defender's Luck should resist instead, say so before
  implementation.
- **DoT minimum tick:** `(inflictor_level + 2) − victim_level` goes ≤ 0
  when the victim outlevels the inflictor by 2+. Proposed clamp at **1**
  (an applied effect always ticks something); clamp at 0 if a high-level
  player should shrug poisons off entirely.
- **In-pool winner selection:** within one drop pool, every tuple rolls its
  own `dropRate`; when several succeed, proposed: pick one at random among
  the successes. (Alternative: first success in array order, which makes
  ordering matter.) The "one item per pool" outcome is the same either way.
- **Level curve tuning:** max level is decided (20) but the `growth = 1.1`
  shape is still a proposal; the `levels` table is the source of truth, so
  a playtest can retune it without code changes.
