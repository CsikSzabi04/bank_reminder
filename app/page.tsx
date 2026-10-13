import { BRAND } from "@/lib/brand";

// Ideiglenes nyitóoldal a scaffoldhoz; a valódi főoldal a dashboard (B-14)
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <h1 className="text-2xl font-semibold">{BRAND.name}</h1>
    </main>
  );
}
