import { Dancing_Script } from "next/font/google";
import Image from "next/image";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { loginLore } from "@/lib/loginLore";

const handwriting = Dancing_Script({ subsets: ["latin"], weight: ["500", "700"] });

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between gap-6 bg-black py-12">
      <Image
        src="/icon.png"
        alt="Aldryon Logo"
        width={1024}
        height={559}
        priority
        className="h-auto w-64"
      />
      <div className="relative flex flex-1 items-center justify-center">
        <Image
          src="/papiro.png"
          alt=""
          width={1024}
          height={1536}
          priority
          className="h-auto max-h-[70vh] w-auto"
        />
        <div className="absolute inset-0 flex items-center justify-center px-[18%] py-[22%]">
          <p
            className={`${handwriting.className} max-w-md whitespace-pre-line text-center text-lg leading-relaxed text-stone-900 sm:text-xl`}
          >
            {loginLore.en}
          </p>
        </div>
      </div>
      <GoogleLoginButton />
    </main>
  );
}
