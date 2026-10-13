import { NotFoundView } from "@/components/shell/not-found-view";

// Ismeretlen útvonal (a shell-en kívül)
export default function NotFound() {
  return (
    <main id="main" className="min-h-dvh bg-bg px-4">
      <NotFoundView />
    </main>
  );
}
