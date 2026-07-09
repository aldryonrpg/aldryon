import Image from "next/image";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between gap-8 bg-black py-12">
      <div className="flex flex-1 items-center justify-center">
        <Image
          src="/papiro.png"
          alt=""
          width={1024}
          height={1536}
          priority
          className="h-auto max-h-[80vh] w-auto"
        />
      </div>
      <GoogleLoginButton />
    </main>
  );
}
