import { Suspense } from "react";
import { ConversasScreen } from "@/ui/saas/ConversasScreen";
import { COPY } from "@/ui/copy";
import { SaasPage } from "@/ui/layout";
import { TableSkeleton } from "@/ui/states";

export default function Page() {
  return (
    <Suspense
      fallback={
        <SaasPage title={COPY.crm.conversas_title}>
          <TableSkeleton />
        </SaasPage>
      }
    >
      <ConversasScreen />
    </Suspense>
  );
}
