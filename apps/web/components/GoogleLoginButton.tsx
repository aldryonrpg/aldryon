"use client";

import Image from "next/image";
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
      aria-label="Sign in with Google"
      className="transition hover:brightness-110 active:brightness-95"
    >
      <Image
        src="/login_button.png"
        alt="Sign in with Google"
        width={1024}
        height={559}
        priority
        className="h-auto w-96"
      />
    </button>
  );
}
