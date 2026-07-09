"use client";

import { createClient } from "@/lib/supabase/client";

export function GoogleLoginButton() {
  const handleClick = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-md bg-white px-6 py-3 font-medium text-stone-900 shadow-lg transition hover:bg-stone-200"
    >
      Sign in with Google
    </button>
  );
}
