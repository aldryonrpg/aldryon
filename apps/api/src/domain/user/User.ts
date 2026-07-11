export interface UserProps {
  id: string;
  externalAuthId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  username: string | null;
  isVip: boolean;
}

const USERNAME_PATTERN = /^[A-Za-z0-9]{5,40}$/;

/**
 * Aggregate root for an authenticated player. `externalAuthId` is the
 * Supabase auth user id — the domain never sees raw Google/Supabase tokens.
 * `username` is chosen by the player after signup (Google gives us no
 * username), so it starts out null on first login.
 */
export class User {
  private constructor(private readonly props: UserProps) {}

  static create(props: UserProps): User {
    if (!props.email.includes("@")) {
      throw new Error("User email must be a valid email address");
    }
    if (props.username !== null && !USERNAME_PATTERN.test(props.username)) {
      throw new Error("Username must be 5-40 alphanumeric characters");
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

  get username(): string | null {
    return this.props.username;
  }

  get isVip(): boolean {
    return this.props.isVip;
  }

  toProps(): UserProps {
    return { ...this.props };
  }
}
