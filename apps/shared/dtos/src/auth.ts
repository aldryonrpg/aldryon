import { z } from "zod";

/**
 * Sent by apps/web after Supabase completes the Google OAuth redirect on the
 * client. apps/api treats this token as untrusted input and verifies it
 * against Supabase before issuing an app session.
 */
export const LoginRequestSchema = z.object({
  supabaseAccessToken: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  username: z
    .string()
    .regex(/^[A-Za-z0-9]{1,40}$/)
    .nullable(),
  isVip: z.boolean(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const LoginResponseSchema = z.object({
  user: UserProfileSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
