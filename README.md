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
HitChance = (AttackerDexterity / DefenderDexterity) × 100 + AttackerLuck
```

- `HitChance >= 100` → guaranteed hit.
- Otherwise roll a random integer in `[20, 100]`; the attack hits if
  `roll <= HitChance`, misses (0 damage) otherwise.

### Damage

```
attack_value  = ceil(attack.multiplier × effective(attacker's scaling attribute))
defense_value = ceil((defender_level − 1) × effective(defender's scaling attribute) / 2)
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
  never 0 (combat-balance follow-up: the original `defender_level ×
  attribute` defense term grew fast enough to stalemate both sides at 0
  damage once either side reached a non-trivial level/attribute; halving
  it and excluding the defender's first level from the multiplier, plus
  this floor, keeps a landed hit meaningful at every level).
- `stamina_cost` is **added**, not multiplied, so **`HIT`** — the nearly-free
  fallback attack every player and monster always has, 5 Stamina cost (the
  same amount both sides passively regen every round), ×1.0 multiplier,
  Strength-scaling — needs no special-casing. **`STRONG HIT`** is the
  player-only, harder-hitting Strength option above it: 10 Stamina, ×1.5
  multiplier, requires 20 Strength (no monster equivalent — monsters have
  no requirement-gated attacks, same as `BURN SPELL`). Every other
  damage-dealing attack (`BURN SPELL` ×1.5, the Dragon's `Dragon Breath`
  ×1.2) sits above ×1 too. The pure-debuff monster specials (`Fear`,
  `Magic Aura Blast`, `Stun`) and `REVEAL SPELL` intentionally keep a ×0
  multiplier — their value is the status effect/reveal, not direct damage.
- A side's defensive scaling attribute is fixed to its own `HIT` attack's
  scaling attribute for the whole battle (there's no "last attack used"
  state tracked on a battle).

### Battle effects (bleed / poison / burn)

```
roll <= (AttackerLuck − DefenderLuck)   // roll is a random integer in [20, 100]
```

- One unified proc roll, both directions. Because the roll floor is 20, an
  effect can never land below a **20-point Luck lead**.
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
  already stunned refreshes it back to 2 full turns. **Stun can never
  chain**, though: the instant it unleashes, the attack that caused it is
  excluded from the monster's attack selection for `STUN_COOLDOWN_ROUNDS`
  rounds (env-configurable, default 5) regardless of Stamina — it isn't
  just de-prioritized, it's off the table entirely until the cooldown hits
  0. The cooldown ticks down every round regardless of what the monster
  does that round.

### Monster attack selection (AI)

On its turn, a monster picks from its moveset (excluding anything it can't
afford, and excluding any Stun-applying attack still on cooldown) as follows:

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
# Rounds a Stun-applying special is excluded from selection after it unleashes
# (see "Monster attack selection" above). Optional, default 5.
STUN_COOLDOWN_ROUNDS=5
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
