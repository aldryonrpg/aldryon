import { User } from "@/domain/user/User";
import type { AuthGateway } from "@/usecase/auth/AuthGateway";
import type { UserRepository } from "@/usecase/user/UserRepository";

export interface AuthenticateUserInput {
  supabaseAccessToken: string;
}

export interface AuthenticateUserOutput {
  user: User;
}

/**
 * Exchanges a Supabase access token (obtained by apps/web after the Google
 * OAuth redirect) for an app session by verifying it against Supabase and
 * upserting the corresponding domain User.
 */
export class AuthenticateUserUseCase {
  constructor(
    private readonly authGateway: AuthGateway,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: AuthenticateUserInput): Promise<AuthenticateUserOutput> {
    const identity = await this.authGateway.verifyAccessToken(input.supabaseAccessToken);

    const existing = await this.userRepository.findByExternalAuthId(identity.externalAuthId);

    const user = User.create({
      id: existing?.id ?? Bun.randomUUIDv7(),
      externalAuthId: identity.externalAuthId,
      email: identity.email,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      // username/isVip are player-owned profile state, not auth claims —
      // preserve them across logins instead of resetting on every sync.
      username: existing?.username ?? null,
      isVip: existing?.isVip ?? false,
    });

    const saved = await this.userRepository.upsert(user);

    return { user: saved };
  }
}
