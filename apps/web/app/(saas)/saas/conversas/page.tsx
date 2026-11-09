import { Suspense } from "react";
import { ConversasScreen } from "@/ui/saas/ConversasScreen";
import { TableSkeleton } from "@/ui/states";
import { SaasPage } from "@/ui/layout";
import { COPY } from "@/ui/copy";

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
