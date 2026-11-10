import { Suspense } from "react";
import { GuiaUsuarioHomeScreen } from "@/ui/saas/GuiaUsuarioScreen";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="px-4 py-8 text-sm text-muted-foreground lg:px-0">Carregando…</main>
      }
    >
      <GuiaUsuarioHomeScreen />
    </Suspense>
  );
}
