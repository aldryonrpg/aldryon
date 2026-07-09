/**
 * Identity claims proven by the auth provider (Supabase/Google) for a
 * request. Not yet a domain User until resolved against the user repository.
 */
export interface AuthenticatedIdentity {
  externalAuthId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}
