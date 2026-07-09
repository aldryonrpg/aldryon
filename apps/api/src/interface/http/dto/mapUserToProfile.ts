import type { UserProfile } from "@aldryon/dtos";
import type { User } from "@/domain/user/User";

export function mapUserToProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    username: user.username,
    isVip: user.isVip,
  };
}
