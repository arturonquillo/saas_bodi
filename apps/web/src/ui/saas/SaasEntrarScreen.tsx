"use client";

import Link from "next/link";
import { BrandMark } from "../BrandMark";
import { COPY } from "../copy";
import { AuthStage } from "../layout";
import { LoginForm } from "../LoginForm";

/** Mirrors saas-starter app/(login)/login.tsx — centered marketing login, no Card chrome. */
export function SaasEntrarScreen() {
  return (
    <AuthStage>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <BrandMark href="/saas/entrar" fallback={COPY.marca} />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
          {COPY.login_title_saas}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <LoginForm surface="saas" redirectTo="/saas/conversas" />
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-background px-2 text-muted-foreground">Casa dos Frios</span>
            </div>
          </div>
          <div className="mt-6">
            <Link
              href="/loja"
              className="flex w-full cursor-pointer justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
            >
              Ir para a loja
            </Link>
          </div>
        </div>
      </div>
    </AuthStage>
  );
}
