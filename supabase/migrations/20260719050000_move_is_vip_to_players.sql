-- isVip is player-owned profile state, not an auth claim (see
-- AuthenticateUserUseCase's now-removed preservation comment) — it gates
-- gameplay benefits (bag capacity, dungeon daily attempts, run cooldown),
-- never anything about the identity itself, so it belongs on the `players`
-- aggregate it actually affects, not on `users`. Moving it also lets every
-- VIP-gated usecase read `player.isVip` off the Player row it already
-- loads, instead of threading a separately-cached `isVip` value through
-- Hono context on every request — one source of truth instead of two that
-- could technically drift apart within the auth cache's TTL window.
alter table players add column is_vip boolean not null default false;

update players
set is_vip = users.is_vip
from users
where players.user_id = users.id;

alter table users drop column is_vip;
