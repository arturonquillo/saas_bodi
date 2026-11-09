"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandMark } from "../BrandMark";
import { COPY } from "../copy";
import { AUTH_CARD, AuthStage } from "../layout";
import { LoginForm } from "../LoginForm";

export function EntrarScreen() {
  const search = useSearchParams();
  const redirectTo = search.get("return") || "/loja";

  return (
    <AuthStage>
      <Card className={AUTH_CARD}>
        <CardHeader className="space-y-4">
          <BrandMark href="/loja" />
          <CardTitle className="font-display text-xl">{COPY.login_title_loja}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm surface="loja" redirectTo={redirectTo} />
          <p className="text-sm text-muted-foreground">
            Não tem conta?{" "}
            <Link href="/loja/cadastro" className="text-primary hover:underline">
              {COPY.cta_cadastrar}
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthStage>
  );
}
