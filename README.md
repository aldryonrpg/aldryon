# Aldryon — A Text Based RPG

Aldryon is a text-based RPG built as a monorepo with a web Next.js front-end and a Bun API back-end.

## Gameplay

You fight monsters in turn-based battles. Both you and the monster have
**attributes** (Strength, Dexterity, Agility, Intelligence, Vitality, Luck),
which determine how much damage each attack deals. You also have **HP**
(health) and **Stamina** — attacks cost Stamina to perform.

On your turn, you choose one of:

- **Attack** — fight the monster, spending Stamina and dealing damage based
  on attributes.
- **Rest** — recover Stamina.
- **Bag** — use an item.
- **Run** — try to flee the battle; there's a chance the monster gets a free
  attack on you as you do.

Killing a monster grants **XP**. Enough XP levels you up, increasing your
attributes. The core risk: **if you die, you lose 1% of your XP.**

## Combat math

Every number below is the actual formula the back-end runs, not an
approximation — useful if you're balancing seed data (attacks, monsters,
items) in the database.

### Attributes, HP and Stamina

- All six attributes are integers with a floor of **1** for a fighter
  (player or monster). Equipped item bonuses start at **0** and can be
  negative, but a fighter's *effective* attribute (base + bonuses) never
  drops below 1.
- **Max HP** = `100 + 10 × Vitality + 1 × Strength` (effective attributes).
- **Max Stamina** = `min(100, 20 + 5 × level)` for **players**, 25 at level 1,
  +5 per level, capped at 100 from level 16 onward. **Monsters use their own
  `max_stamina` catalog column instead** — a plain tunable number per
  monster, not derived from level — since the attack-selection AI (below)
  needs headroom well above what the player formula would give a low-level
  monster.
- Both sides passively recover **5 Stamina** at the end of every round;
  choosing **Rest** (or a monster resting/charging) grants **15 instead of
  5** — not additive.

### Hit chance

```
HitChance = (AttackerDexterity / DefenderAgility) × 100 + AttackerLuck
```

- `HitChance >= 100` → guaranteed hit.
- Otherwise roll a random integer in `[10, 100]`; the attack hits if
  `roll <= HitChance`, misses (0 damage) otherwise.

### Damage

```
attack_value  = ceil(attack.multiplier × effective(attacker's scaling attribute))
defense_value = ceil(floor[(defender_level + 1) / 2] × effective(defender's scaling attribute) / 2)
Damage        = max(1, attack_value + attack.stamina_cost − defense_value)
```

- Every attack has a `scaling_attribute` — **Strength** for physical attacks,
  **Intelligence** for magical ones — used both offensively (the attacker's
  multiplier) and defensively (the defender's level × attribute).
- **Both `attack_value` and `defense_value` always round UP** (never down)
  before being combined — a fractional multiplier or bonus never quietly
  favors the defender.
- The attacker's own level never factors into their own damage output —
  only into their *defense* against the other side.
- **A landed hit always deals at least 1 damage** — `Damage` floors at 1,
  never 0.
- `stamina_cost` is **added**, not multiplied, so **`HIT`** — the nearly-free
  fallback attack every player and monster always has, 5 Stamina cost (the
  same amount both sides passively regen every round), ×1.0 multiplier,
  Strength-scaling — needs no special-casing.
- The pure-debuff monster specials (`Fear`,
  `Magic Aura Blast`, `Stun`) and `REVEAL SPELL` intentionally keep a ×0
  multiplier — their value is the status effect/reveal, not direct damage.
- A side's defensive scaling attribute is fixed to its own `HIT` attack's
  scaling attribute for the whole battle (there's no "last attack used"
  state tracked on a battle).

### Battle effects (bleed / poison / burn)

```
roll <= (AttackerLuck − DefenderLuck)   // roll is a random integer in [5, 100]
```

- One unified proc roll, both directions, with its own roll bounds separate
  from the hit-chance roll above (tuning one never silently changes the
  other). Because the roll floor is 5, an effect can never land below a
  **5-point Luck lead**.
- **Monster → player**: rolled on every successful monster hit, using the
  monster's `monster_type` (`normal → bleed`, `poisonous → poison`).
- **Player → monster**: only the `BURN SPELL` attack (the player's one DoT)
  rolls this, applying `burn`.
- DoT magnitude is computed once when applied and never changes afterward:
  `max(1, inflictor_level + 2 − victim_level)`. It ticks every round
  (starting the round it's applied) until cured or the battle ends.
- **Bleed and poison stack unlimited.** Re-procing the same kind doesn't
  replace or refresh an existing instance — it adds a separate one, so a
  target can be carrying any number of stacked bleeds/poisons at once,
  each ticking its own damage every round.
- Curing: consuming the matching item via the Bag action removes **every**
  stacked instance of that kind in one use — one bandage cures all
  stacked bleeds, one antidote cures all stacked poisons. `bandage` and
  `antidote` still only carry up to **5** in their own dedicated bag slot
 — that's a cap on how many cure items you can hold, unrelated
  to how many times the effect itself can stack on you. The player's
  `burn` on a monster has no cure (monsters carry no bag).

### Special attacks (monsters only)

- Flagged `is_special` with `charge_turns >= 1`.
- **A monster's moveset holds at most 2 special attacks** — enforced by a
  Postgres trigger on `monster_movesets` (a plain `CHECK` can't count
  related rows), not app-level validation, since movesets are only ever
  assigned via seed data/migrations today. With "an affordable special
  always wins" (below) unlimited specials would otherwise let a monster
  almost never throw a normal attack.
- The monster must rest that many turns to charge — no strike, Stamina
  regenerates at the Rest rate, and the turn report carries a warning
  message.
- On unleash: **guaranteed hit** (no roll) and **guaranteed effect** (100%,
  no Luck roll) — the monster's innate type DoT, plus any explicit effect
  the special itself carries, layered on top. The multiplier can be far
  above a normal attack, or ≈0 for a pure-debuff special.

Three special attacks are pure status effects (multiplier ≈0 — their value
is the effect, not direct damage):

- **Fear** (-50% Strength) and **Magic Aura Blast** (-50% Intelligence): a
  percentage stat-decay debuff on the player. Held at -50% for 2 rounds,
  then recovers 10 points a round — `50, 50, 40, 30, 20, 10`, then back to
  normal. The percent applies to the player's already-computed effective
  stat (base + item bonuses), floored, and the fighter's usual ≥1 floor
  still holds. Re-applying either while one is already active **refreshes**
  it back to -50% instead of stacking.
- **Stun**: the player loses their **next 2 turns** entirely — Attack, Bag,
  Rest, and Run all become no-ops for those turns (only the passive +5
  Stamina regen happens) — while the monster keeps attacking normally.
  "2 turns" means 2 actual voided actions, not 2 rounds of calendar time,
  so nothing is lost if the player is slow to act. Re-applying Stun while
  already stunned refreshes it back to 2 full turns.

**None of these three can chain**: the instant any of Stun/Fear/Magic Aura
Blast unleashes, the attack that caused it is excluded from the monster's
attack selection for `STATUS_COOLDOWN_ROUNDS` rounds (env-configurable,
default 5, one shared cooldown for all three kinds — not one per kind)
regardless of Stamina — it isn't just de-prioritized, it's off the table
entirely until the cooldown hits 0. The cooldown ticks down every round
regardless of what the monster does that round. Fear/Magic Aura Blast don't
stack anyway (see above), so re-landing the same one back-to-back would
barely matter without this.

### Monster attack selection (AI)

On its turn, a monster picks from its moveset (excluding anything it can't
afford, and excluding any Stun/Fear/Magic-Aura-Blast-applying attack still
on the shared cooldown) as follows:

1. **A special always wins if one is affordable.** Any charge-ready special
   guarantees a hit and a 100% effect proc on unleash, so it's always the
   stronger play — the monster starts charging it unconditionally, without
   comparing it to any normal attack's damage. Ties among several
   simultaneously-affordable specials are broken randomly.
2. **Otherwise, normal attacks are scored `damage + weight`.** `damage` is
   what that attack would deal if it hits (the same formula as "Damage"
   above); `weight` is how many consecutive turns that attack has gone
   unpicked, starting at 0 and resetting to 0 the turn it's picked. The
   highest score wins, ties broken by moveset order. A long-unused weaker
   attack can eventually outscore a frequently-picked stronger one, so the
   monster rotates through its moveset instead of always repeating the
   single highest-damage hit.
3. **If nothing is affordable, the monster rests** (Stamina regenerates at
   the Rest rate instead of the passive rate).

Weight only tracks normal attacks — specials are never scored this way,
since rule 1 already decides them unconditionally.

### XP, leveling and death

- XP cap: **1,000,000**. Level is the highest row in the `levels` table
  whose `xp_required <= xp`.
- Each level gained from a kill grants `LEVEL_UP_ATTRIBUTE_POINTS`
  attribute points (env-configurable, default 4).
- Dying costs **1% of total XP** (floored), which can de-level the player.
  Death has **no cooldown** — you can start a new battle immediately.
- A successful flee starts a cooldown before the next battle (**30s**, or
  **15s** for VIP players). A fatal parting hit while fleeing runs the same
  death settlement instead of the cooldown.

### Encounters

- **20%** of the time, starting a battle finds nothing.
- Otherwise a monster is picked at random from the chosen region, then
  rolls its own `ambush_chance` for one unrolled free strike before the
  player ever acts (a special attack can never be used for an ambush).

## Dungeons

Dungeons are a separate, level-gated game mode from ordinary battles — a
short gauntlet of fights capped off by a boss, once per day.

- Unlocked at player **level 10**; `/dungeon/start` rejects anyone below it.
- **Tier is derived purely from the player's own level**, not a shared daily
  rotation: **10–14 → Tier 1, 15–19 → Tier 2, 20+ → Tier 3** (no Tier 4 to
  grow into). Two players at the same level always face the identical
  (materialized) boss row for their tier.
- Every tier scales a dungeon monster's `hp`, attributes, and `maxStamina`
  by a flat multiplier — **1.0× / 1.5× / 2.0×** for Tier 1/2/3 — always
  rounded with `Math.ceil`, the same "never round in the defender's favor"
  convention as the damage formula. The monster's `level` is also forced to
  the tier's fixed value (**10/15/20**) for the fight, regardless of its
  catalog level.
- **Daily attempts**: 1 per day normally, **2 for VIP**, tracked via two
  nullable timestamps on the player row and compared by UTC calendar day —
  a slot from a previous UTC day simply doesn't count today, no explicit
  reset job runs. Hitting the limit reports the next UTC midnight as the
  reset time.

### Run structure

- `/dungeon/start` always finds a monster — no 20% empty-encounter roll like
  a normal battle start — but the ambush roll still applies as usual.
- A run is `stepsPerTier` regular fights, then the boss: **1 fight for Tier
  1, 3 for Tier 2, 5 for Tier 3**.
- Each step, the monster is a random catalog monster "Dungeon Enhanced" live
  for the tier (stats scaled and level forced, as above) — nothing is
  written to the `monsters` table for a regular step, so any catalog monster
  can fill any step at any tier.
- Killing a step's monster fully settles that battle; the player must
  explicitly call `/dungeon/continue` to advance to the next step or reveal
  the boss.
- Dying at any point clears the run (tier/step/progress reset) on top of the
  normal death settlement — no separate dungeon cooldown. `/dungeon/exit`
  lets the player abandon a run that's awaiting that Continue/Exit decision
  without dying first.

### Boss of the day

- One boss is active for the whole day, chosen from a single seeded
  encounter pairing (today there's only ever one boss configured, so this
  always resolves to it — the lookup is a seam for a future rotating pool).
  All 3 tier-scaled versions are materialized as real `monsters` rows on
  first request, idempotent by name, then cached in memory until the next
  UTC midnight — every reveal for the rest of the day, across every player
  and tier, reuses the same cached rows.
- Unlike a regular step monster, **the boss's own `xpGain` is scaled by the
  tier multiplier** too.
- Revealing the boss always triggers the **Growl**: a roll of **0–50%
  (inclusive)** of the player's total remaining POTs (small/medium/big)
  break — `ceil(total × percent / 100)` units, smallest-stack-first,
  spilling into the next stack once one is fully drained. A roll of 0 still
  narrates the Growl, just breaks nothing.

### Leaderboard

- `GET /dungeon/leaderboard` — top 50 players by boss kills descending,
  ties broken by last-kill time ascending. Cached in-process for **5
  minutes**, since it's rendered on every logged-in player's Main Page.

## Tech stack

- **Front-end** (`apps/web`) — [Next.js](https://nextjs.org/) (TypeScript),
  handles the UI and starts Google login via
  [Supabase Auth](https://supabase.com/auth).
- **Back-end** (`apps/api`) — [Bun](https://bun.sh/) + [Hono](https://hono.dev/),
  built with **Clean Architecture + DDD** (`domain` → `usecase` →
  `interface`, with `infrastructure` implementing the boundaries). Verifies
  Google login via Supabase Auth and talks to **Postgres** (Supabase-hosted)
  directly.
- **Database & Auth** — [Supabase](https://supabase.com/) (Postgres + Google
  OAuth).
- **Shared contracts** (`apps/shared/dtos`) — Zod schemas shared between web
  and api.
- **Tooling** — [Biome](https://biomejs.dev/) (lint + format), husky +
  lint-staged (pre-commit), [testcontainers](https://testcontainers.com/)
  (integration tests), [Trivy](https://trivy.dev/) (vulnerability scanning).
- **CI/CD** — GitHub Actions, deployed on [Render](https://render.com/).

## Environment variables

Create **`apps/api/.env`** (gitignored):

```bash
DATABASE_URL=postgresql://postgres:<password>@<host>:5432/postgres
# Supabase Auth (GoTrue) — used only to verify Google login tokens.
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
# Attribute points granted per level-up (see "Combat math" above). Optional, default 4.
LEVEL_UP_ATTRIBUTE_POINTS=4
# Rounds a Stun/Fear/Magic-Aura-Blast-applying special is excluded from
# selection after it unleashes (see "Monster attack selection" above). Optional, default 5.
STATUS_COOLDOWN_ROUNDS=5
# Optional: PORT (default 3001), WEB_ORIGIN (default http://localhost:3000)
SET_ATTRIBUTE_BONUS=2
# This is the Set Completion Bonus for All Attributes 
```

Create **`apps/web/.env.local`** (gitignored):

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

## Running with Docker / Podman

`bun run docker:up` builds and starts **both** apps from the same
Dockerfiles Render deploys (`apps/api/Dockerfile`, `apps/web/Dockerfile`) via
the repo-root `docker-compose.yml` — api on `:3001`, web on `:3000`. Both
read their env vars from the files above (`api` via `env_file`; `web`'s
`NEXT_PUBLIC_*` are baked in at **build time**, since Next.js inlines them
client-side).

| Script                 | What it does                |
| ----------------------- | --------------------------- |
| `bun run docker:up`   | Build + start both containers |
| `bun run docker:down` | Stop them                     |
| `bun run docker:logs` | Tail both containers' logs    |

Uses **`podman compose`** (Podman is the assumed local runtime — start the
machine first: `podman machine start`). On **Docker Desktop**, run the same
`docker compose …` commands directly, or edit the scripts.
