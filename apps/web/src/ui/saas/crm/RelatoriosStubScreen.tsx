"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { COPY } from "../../copy";
import { SaasPage } from "../../layout";

export function RelatoriosStubScreen() {
  return (
    <SaasPage title={COPY.crm.nav_relatorios}>
      <Alert>
        <AlertTitle>{COPY.crm.nav_relatorios}</AlertTitle>
        <AlertDescription>{COPY.crm.relatorios_stub}</AlertDescription>
      </Alert>
    </SaasPage>
  );
}
