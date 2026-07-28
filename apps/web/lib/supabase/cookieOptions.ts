import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Forces the `Secure` flag in production (Render serves everything over
 * HTTPS) so the auth cookie can never be sent over a plain-HTTP connection,
 * even by accident — @supabase/ssr's own default leaves `secure` unset.
 * Left off in local dev on purpose: `secure: true` makes the browser
 * silently refuse to store or send the cookie at all over
 * `http://localhost`, which would break login for every developer running
 * `bun run dev`.
 *
 * This doesn't change `httpOnly` (stays `false`) — this app's own
 * `getAccessToken()` (apps/web/lib/api.ts) needs JS access to the session
 * to attach it as a Bearer token on every request to apps/api, so an
 * HttpOnly cookie isn't an option here regardless.
 */
export const SUPABASE_COOKIE_OPTIONS: CookieOptionsWithName = {
  secure: process.env.NODE_ENV === "production",
};
