"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Account out of MVP. */
export function ContaEntrarScreen() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">Conta fora do MVP</h1>
      <Button asChild className="mt-6">
        <Link href="/">Voltar</Link>
      </Button>
    </main>
  );
}
