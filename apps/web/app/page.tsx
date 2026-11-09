import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Casa dos Frios</h1>
      <p className="text-muted-foreground">Loja atacadista e SaaS CRM. Conta fora do MVP.</p>
      <ul className="space-y-3 text-base">
        <li>
          <Link className="text-primary underline-offset-4 hover:underline" href="/loja">
            Loja
          </Link>
        </li>
        <li>
          <Link className="text-primary underline-offset-4 hover:underline" href="/saas">
            SaaS
          </Link>
        </li>
      </ul>
      <p className="text-sm text-muted-foreground">
        Demo: admin@casadosfrios.local · vendedor@casadosfrios.local · cliente@mercadoexemplo.local ·
        prospecto@novaloja.local — senha Demo@1234
      </p>
    </main>
  );
}
