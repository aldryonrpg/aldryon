export interface UserProps {
  id: string;
  externalAuthId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  isVip: boolean;
}

/**
 * Aggregate root for an authenticated identity — auth/profile only.
 * `externalAuthId` is the Supabase auth user id — the domain never sees raw
 * Google/Supabase tokens. Gameplay state (the on-screen player name,
 * attributes, etc.) lives on the separate `Player` aggregate, never here.
 */
export class User {
  private constructor(private readonly props: UserProps) {}

  static create(props: UserProps): User {
    if (!props.email.includes("@")) {
      throw new Error("User email must be a valid email address");
    }
    return new User(props);
  }

  get id(): string {
    return this.props.id;
  }

  get externalAuthId(): string {
    return this.props.externalAuthId;
  }

  get email(): string {
    return this.props.email;
  }

  get displayName(): string | null {
    return this.props.displayName;
  }

  get avatarUrl(): string | null {
    return this.props.avatarUrl;
  }

  get isVip(): boolean {
    return this.props.isVip;
  }

  toProps(): UserProps {
    return { ...this.props };
  }
}
