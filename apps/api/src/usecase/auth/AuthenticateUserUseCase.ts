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
      // isVip is player-owned profile state, not an auth claim — preserve
      // it across logins instead of resetting on every sync.
      isVip: existing?.isVip ?? false,
    });

    const saved = await this.userRepository.upsert(user);

    return { user: saved };
  }
}
