# Aldryon — A Text Based RPG

Aldryon is a text-based RPG built as a monorepo with a web Next.js front-end and a Bun API back-end.

## Gameplay

You fight monsters in turn-based battles. Both you and the monster have
**attributes** (Force, Dexterity, Agility, Intelligence, Vitality, Luck),
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
- **Max HP** = `100 + 10 × Vitality + 1 × Force` (effective attributes).
- **Max Stamina** = `min(100, 20 + 5 × level)` — 25 at level 1, +5 per
  level, capped at 100 from level 16 onward. Monsters use their own fixed
  catalog level for this too.
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
attack_value  = attack.multiplier × effective(attacker's scaling attribute)
defense_value = defender_level × effective(defender's scaling attribute)
Damage        = max(0, attack_value + attack.stamina_cost − defense_value)
```

- Every attack has a `scaling_attribute` — **Force** for physical attacks,
  **Intelligence** for magical ones — used both offensively (the attacker's
  multiplier) and defensively (the defender's level × attribute).
- The attacker's own level never factors into their own damage output —
  only into their *defense* against the other side.
- `stamina_cost` is **added**, not multiplied, so **`HIT`** — the free
  fallback attack every player and monster always has, 0 Stamina cost,
  ×0.4 multiplier, Force-scaling — needs no special-casing.
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
- Curing: consuming the matching item via the Bag action removes the
  effect — `bandage` cures bleed, `antidote` cures poison. The player's
  `burn` on a monster has no cure (monsters carry no bag).

### Special attacks (monsters only)

- Flagged `is_special` with `charge_turns >= 1`.
- The monster must rest that many turns to charge — no strike, Stamina
  regenerates at the Rest rate, and the turn report carries a warning
  message.
- On unleash: **guaranteed hit** (no roll) and **guaranteed effect** (100%,
  no Luck roll) — the monster's innate type DoT, plus any explicit effect
  the special itself carries, layered on top. The multiplier can be far
  above a normal attack, or ≈0 for a pure-debuff special.

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
# Optional: PORT (default 3001), WEB_ORIGIN (default http://localhost:3000)
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
