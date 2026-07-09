import Image from "next/image";

export default function MainPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-8">
      <Image
        src="/mapa.png"
        alt=""
        width={1024}
        height={479}
        priority
        className="h-auto w-full max-w-3xl"
      />
    </main>
  );
}
