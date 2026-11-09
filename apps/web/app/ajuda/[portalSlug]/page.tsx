import { Suspense } from "react";
import { HelpPortalHomeScreen } from "@/ui/public/HelpPortalScreens";

export default function Page() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Carregando…</main>}>
      <HelpPortalHomeScreen />
    </Suspense>
  );
}
