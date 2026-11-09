"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandMark } from "../BrandMark";
import { COPY } from "../copy";
import { AUTH_CARD, AuthStage } from "../layout";
import { LoginForm } from "../LoginForm";

export function SaasEntrarScreen() {
  return (
    <AuthStage>
      <Card className={AUTH_CARD}>
        <CardHeader className="space-y-4">
          <BrandMark href="/saas/entrar" fallback={COPY.marca} />
          <CardTitle className="font-display text-xl">{COPY.login_title_saas}</CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm surface="saas" redirectTo="/saas/inbox" />
        </CardContent>
      </Card>
    </AuthStage>
  );
}
