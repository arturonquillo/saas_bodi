"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { isAdmin, SKU_UNIDADES } from "@saas-frota/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  apiGet,
  apiSend,
  asPage,
  isApiError,
  movementMotivo,
  movementQty,
  type EstoqueItemDto,
  type MovementDto,
  type SkuUnidadeDto,
} from "../api";
import { COPY } from "../copy";
import { DetailNavButton } from "../DetailNavRow";
import { formatDate, formatMoney } from "../format";
import { SaasPage } from "../layout";
import { useSession } from "../session";
import { ErrorState, FormSkeleton, TableSkeleton } from "../states";

const selectClass =
  "border-input flex h-9 w-full min-w-0 cursor-pointer rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

function reaisToCentavos(raw: string) {
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function centavosToReaisInput(centavos: number) {
  return (centavos / 100).toFixed(2);
}

type MasterFormState = {
  codigo: string;
  nome: string;
  descricao: string;
  unidade: SkuUnidadeDto;
  preco_reais: string;
  desconto_max_pct: string;
  qtd_min_atacado: string;
  on_hand: string;
  visivel_loja: boolean;
  ativo: boolean;
};

function emptyCreateForm(): MasterFormState {
  return {
    codigo: "",
    nome: "",
    descricao: "",
    unidade: "un",
    preco_reais: "0.00",
    desconto_max_pct: "0",
    qtd_min_atacado: "1",
    on_hand: "0",
    visivel_loja: true,
    ativo: true,
  };
}

function formFromItem(item: EstoqueItemDto): MasterFormState {
  return {
    codigo: item.codigo,
    nome: item.nome,
    descricao: item.descricao ?? "",
    unidade: item.unidade ?? "un",
    preco_reais: centavosToReaisInput(item.preco_atacado_centavos),
    desconto_max_pct: String(item.desconto_max_pct ?? 0),
    qtd_min_atacado: String(item.qtd_min_atacado),
    on_hand: String(item.on_hand),
    visivel_loja: item.visivel_loja,
    ativo: item.ativo !== false,
  };
}

function masterPayload(form: MasterFormState, opts?: { includeOnHand?: boolean; includeCodigo?: boolean }) {
  const body: Record<string, unknown> = {
    nome: form.nome.trim(),
    descricao: form.descricao.trim() ? form.descricao.trim().slice(0, 500) : null,
    unidade: form.unidade,
    preco_atacado_centavos: reaisToCentavos(form.preco_reais),
    desconto_max_pct: Math.min(100, Math.max(0, Number(form.desconto_max_pct) || 0)),
    qtd_min_atacado: Math.max(1, Number(form.qtd_min_atacado) || 1),
    visivel_loja: form.visivel_loja,
    ativo: form.ativo,
  };
  if (opts?.includeCodigo) body.codigo = form.codigo.trim().toUpperCase();
  if (opts?.includeOnHand) body.on_hand = Math.max(0, Number(form.on_hand) || 0);
  return body;
}

function MasterFields({
  form,
  setForm,
  mode,
}: {
  form: MasterFormState;
  setForm: (next: MasterFormState) => void;
  mode: "create" | "edit";
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="codigo" className="mb-2">
            {COPY.codigo_sku}
          </Label>
          <Input
            id="codigo"
            value={form.codigo}
            disabled={mode === "edit"}
            onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
            required={mode === "create"}
            className="uppercase"
          />
        </div>
        <div>
          <Label htmlFor="unidade" className="mb-2">
            {COPY.unidade}
          </Label>
          <select
            id="unidade"
            className={selectClass}
            value={form.unidade}
            onChange={(e) => setForm({ ...form, unidade: e.target.value as SkuUnidadeDto })}
          >
            {SKU_UNIDADES.map((u) => (
              <option key={u} value={u}>
                {COPY.unidade_label[u] ?? u}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label htmlFor="nome" className="mb-2">
          {COPY.nome}
        </Label>
        <Input
          id="nome"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="descricao" className="mb-2">
          {COPY.descricao}
        </Label>
        <Textarea
          id="descricao"
          value={form.descricao}
          maxLength={500}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          rows={3}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="preco" className="mb-2">
            {COPY.preco_venda} (R$)
          </Label>
          <Input
            id="preco"
            type="number"
            min={0}
            step="0.01"
            value={form.preco_reais}
            onChange={(e) => setForm({ ...form, preco_reais: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="desconto_max" className="mb-2">
            {COPY.desconto_max}
          </Label>
          <Input
            id="desconto_max"
            type="number"
            min={0}
            max={100}
            value={form.desconto_max_pct}
            onChange={(e) => setForm({ ...form, desconto_max_pct: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="moq" className="mb-2">
            {COPY.qtd_min_atacado}
          </Label>
          <Input
            id="moq"
            type="number"
            min={1}
            value={form.qtd_min_atacado}
            onChange={(e) => setForm({ ...form, qtd_min_atacado: e.target.value })}
          />
        </div>
        {mode === "create" ? (
          <div>
            <Label htmlFor="on_hand" className="mb-2">
              {COPY.estoque_inicial}
            </Label>
            <Input
              id="on_hand"
              type="number"
              min={0}
              value={form.on_hand}
              onChange={(e) => setForm({ ...form, on_hand: e.target.value })}
            />
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <Switch
            checked={form.visivel_loja}
            onCheckedChange={(v) => setForm({ ...form, visivel_loja: v })}
          />
          <span>{COPY.visivel_loja}</span>
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
          <span>{COPY.ativo}</span>
        </label>
      </div>
    </div>
  );
}

export function EstoqueListScreen() {
  const { session } = useSession();
  const admin = isAdmin(session?.saas_role);
  const [items, setItems] = useState<EstoqueItemDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [q, setQ] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<"all" | "true" | "false">("all");
  const [filtroVisivel, setFiltroVisivel] = useState<"all" | "true" | "false">("all");
  const router = useRouter();

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (filtroAtivo !== "all") params.set("ativo", filtroAtivo);
      if (filtroVisivel !== "all") params.set("visivel_loja", filtroVisivel);
      const qs = params.toString();
      setItems(asPage<EstoqueItemDto>(await apiGet(`/api/saas/estoque${qs ? `?${qs}` : ""}`)).items);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [q, filtroAtivo, filtroVisivel]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    // Client-side fallback when backend ignores query filters (pre-upgrade tip).
    return items.filter((item) => {
      if (filtroAtivo !== "all") {
        const active = item.ativo !== false;
        if (filtroAtivo === "true" && !active) return false;
        if (filtroAtivo === "false" && active) return false;
      }
      if (filtroVisivel !== "all") {
        if (filtroVisivel === "true" && !item.visivel_loja) return false;
        if (filtroVisivel === "false" && item.visivel_loja) return false;
      }
      if (!q.trim()) return true;
      const needle = q.trim().toLowerCase();
      return item.codigo.toLowerCase().includes(needle) || item.nome.toLowerCase().includes(needle);
    });
  }, [items, q, filtroAtivo, filtroVisivel]);

  return (
    <SaasPage
      title={COPY.estoque_title}
      actions={
        admin ? (
          <Button
            type="button"
            className="cursor-pointer bg-primary text-white hover:bg-primary/90"
            onClick={() => router.push("/saas/estoque/novo")}
          >
            {COPY.novo_produto}
          </Button>
        ) : null
      }
    >
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{COPY.estoque_title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="busca" className="mb-2">
                {COPY.buscar_produto}
              </Label>
              <Input
                id="busca"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={COPY.buscar_produto}
              />
            </div>
            <div>
              <Label htmlFor="filtro-ativo" className="mb-2">
                {COPY.filtro_ativo}
              </Label>
              <select
                id="filtro-ativo"
                className={selectClass}
                value={filtroAtivo}
                onChange={(e) => setFiltroAtivo(e.target.value as typeof filtroAtivo)}
              >
                <option value="all">{COPY.todos}</option>
                <option value="true">{COPY.sim}</option>
                <option value="false">{COPY.nao}</option>
              </select>
            </div>
            <div>
              <Label htmlFor="filtro-visivel" className="mb-2">
                {COPY.filtro_visivel}
              </Label>
              <select
                id="filtro-visivel"
                className={selectClass}
                value={filtroVisivel}
                onChange={(e) => setFiltroVisivel(e.target.value as typeof filtroVisivel)}
              >
                <option value="all">{COPY.todos}</option>
                <option value="true">{COPY.sim}</option>
                <option value="false">{COPY.nao}</option>
              </select>
            </div>
          </div>

          {status === "loading" ? (
            <TableSkeleton />
          ) : status === "error" ? (
            <ErrorState onRetry={() => void load()} />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <h3 className="mb-2 text-lg font-semibold text-foreground">{COPY.estoque_empty}</h3>
              <p className="max-w-sm text-sm text-muted-foreground">{COPY.estoque_empty_hint}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((item) => (
                <li key={item.id}>
                  <DetailNavButton
                    className="rounded-md px-2 py-2"
                    onClick={() => router.push(`/saas/estoque/${item.id}`)}
                    meta={
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {formatMoney(item.preco_atacado_centavos)}
                      </span>
                    }
                  >
                    <p className="font-medium text-foreground">
                      {item.codigo}
                      {item.ativo === false ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          ({COPY.nao} {COPY.ativo.toLowerCase()})
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted-foreground">{item.nome}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {COPY.unidade_label[item.unidade ?? "un"] ?? item.unidade ?? "un"} · {COPY.on_hand}:{" "}
                      {item.on_hand} · {COPY.reserved}: {item.reserved} · {COPY.available}: {item.available}
                      {item.visivel_loja ? "" : ` · ${COPY.visivel_loja}: ${COPY.nao}`}
                    </p>
                  </DetailNavButton>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </SaasPage>
  );
}

export function NovoProdutoScreen() {
  const router = useRouter();
  const { session } = useSession();
  const admin = isAdmin(session?.saas_role);
  const [form, setForm] = useState(emptyCreateForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session && !admin) router.replace("/saas/estoque");
  }, [session, admin, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await apiSend<EstoqueItemDto>(
        "/api/saas/estoque",
        "POST",
        masterPayload(form, { includeCodigo: true, includeOnHand: true }),
      );
      router.push(`/saas/estoque/${created.id}`);
    } catch (err) {
      setError(isApiError(err) ? err.message : COPY.save_fail);
      setBusy(false);
    }
  }

  if (session && !admin) return null;

  return (
    <SaasPage title={COPY.novo_produto}>
      <p className="mb-6 text-sm text-muted-foreground">
        <Link href="/saas/estoque" className="cursor-pointer hover:text-foreground">
          ← {COPY.estoque_title}
        </Link>
      </p>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{COPY.novo_produto}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <MasterFields form={form} setForm={setForm} mode="create" />
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="cursor-pointer" onClick={() => router.push("/saas/estoque")}>
                {COPY.actions.cancelar}
              </Button>
              <Button type="submit" className="cursor-pointer bg-primary text-white hover:bg-primary/90" disabled={busy}>
                {COPY.actions.criar}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </SaasPage>
  );
}

export function SkuDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { session } = useSession();
  const admin = isAdmin(session?.saas_role);
  const [item, setItem] = useState<EstoqueItemDto | null>(null);
  const [movimentos, setMovimentos] = useState<MovementDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [form, setForm] = useState<MasterFormState | null>(null);
  const [editing, setEditing] = useState(false);
  const [delta, setDelta] = useState("0");
  const [motivo, setMotivo] = useState("");
  const [openAdjust, setOpenAdjust] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const sku = await apiGet<EstoqueItemDto>(`/api/saas/estoque/${id}`);
      setItem(sku);
      setForm(formFromItem(sku));
      try {
        setMovimentos(asPage<MovementDto>(await apiGet(`/api/saas/estoque/${id}/movimentos`)).items);
      } catch {
        setMovimentos([]);
      }
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMaster(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !admin) return;
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<EstoqueItemDto>(`/api/saas/estoque/${id}`, "PATCH", masterPayload(form));
      setItem(next);
      setForm(formFromItem(next));
      setEditing(false);
    } catch (err) {
      setError(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function toggleFlag(patch: { visivel_loja?: boolean; ativo?: boolean }) {
    if (!admin || !item) return;
    setBusy(true);
    setError(null);
    try {
      let next: EstoqueItemDto;
      if (patch.visivel_loja !== undefined && patch.ativo === undefined) {
        try {
          next = await apiSend<EstoqueItemDto>(`/api/saas/estoque/${item.id}`, "PATCH", patch);
        } catch {
          next = await apiSend<EstoqueItemDto>(`/api/saas/estoque/${item.id}/visibilidade`, "PATCH", {
            visivel_loja: patch.visivel_loja,
          });
        }
      } else {
        next = await apiSend<EstoqueItemDto>(`/api/saas/estoque/${item.id}`, "PATCH", patch);
      }
      setItem(next);
      setForm(formFromItem(next));
    } catch (err) {
      setError(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function adjust() {
    setBusy(true);
    setError(null);
    try {
      const next = await apiSend<EstoqueItemDto>(`/api/saas/estoque/${id}/ajuste`, "POST", {
        delta_on_hand: Number(delta),
        motivo,
      });
      setItem(next);
      setForm(formFromItem(next));
      setOpenAdjust(false);
      setDelta("0");
      setMotivo("");
      try {
        setMovimentos(asPage<MovementDto>(await apiGet(`/api/saas/estoque/${id}/movimentos`)).items);
      } catch {
        /* keep prior */
      }
    } catch (err) {
      setError(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <SaasPage title={COPY.estoque_title}>
        <FormSkeleton />
      </SaasPage>
    );
  }
  if (status === "error" || !item || !form) {
    return (
      <SaasPage title={COPY.estoque_title}>
        <ErrorState message={COPY.not_found} onRetry={() => void load()} />
      </SaasPage>
    );
  }

  return (
    <SaasPage
      title={item.nome}
      actions={
        admin ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                setEditing((o) => !o);
                setError(null);
                setForm(formFromItem(item));
              }}
            >
              {COPY.editar_produto}
            </Button>
            <Button
              type="button"
              className="cursor-pointer bg-primary text-white hover:bg-primary/90"
              onClick={() => setOpenAdjust((o) => !o)}
            >
              {COPY.adjust_qty}
            </Button>
          </div>
        ) : null
      }
    >
      <p className="mb-6 text-sm text-muted-foreground">
        <Link href="/saas/estoque" className="cursor-pointer hover:text-foreground">
          ← {COPY.estoque_title}
        </Link>
        <span className="mx-2">·</span>
        <span className="text-foreground">{item.codigo}</span>
      </p>

      {openAdjust && admin ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{COPY.adjust_qty}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void adjust();
              }}
            >
              <div>
                <Label htmlFor="delta" className="mb-2">
                  Delta
                </Label>
                <Input id="delta" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="motivo" className="mb-2">
                  {COPY.motivo}
                </Label>
                <Input id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
              </div>
              {error ? <p className="text-sm text-red-500">{error}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setOpenAdjust(false)}>
                  {COPY.actions.cancelar}
                </Button>
                <Button type="submit" className="cursor-pointer bg-primary text-white hover:bg-primary/90" disabled={busy}>
                  {COPY.actions.confirmar}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {editing && admin ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{COPY.editar_produto}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveMaster}>
              <MasterFields form={form} setForm={setForm} mode="edit" />
              {error ? <p className="text-sm text-red-500">{error}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setEditing(false)}>
                  {COPY.actions.cancelar}
                </Button>
                <Button type="submit" className="cursor-pointer bg-primary text-white hover:bg-primary/90" disabled={busy}>
                  {COPY.actions.salvar}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Quantidades</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            <li className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{COPY.on_hand}</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{item.on_hand}</p>
            </li>
            <li className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{COPY.reserved}</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{item.reserved}</p>
            </li>
            <li className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{COPY.available}</p>
              <p className="text-lg font-semibold tabular-nums text-primary">{item.available}</p>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Detalhes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">{COPY.preco_venda}: </span>
            <span className="text-foreground">{formatMoney(item.preco_atacado_centavos)}</span>
          </p>
          <p>
            <span className="text-muted-foreground">{COPY.desconto_max}: </span>
            <span className="text-foreground">{item.desconto_max_pct ?? 0}%</span>
          </p>
          <p>
            <span className="text-muted-foreground">{COPY.unidade}: </span>
            <span className="text-foreground">
              {COPY.unidade_label[item.unidade ?? "un"] ?? item.unidade ?? "un"}
            </span>
          </p>
          <p className="text-muted-foreground">{COPY.moq(item.qtd_min_atacado)}</p>
          {item.descricao ? <p className="text-muted-foreground">{item.descricao}</p> : null}
          <div className="flex flex-wrap gap-6 pt-2">
            <label className="inline-flex items-center gap-2">
              <Switch
                checked={item.visivel_loja}
                disabled={!admin || busy}
                onCheckedChange={(v) => void toggleFlag({ visivel_loja: v })}
              />
              <span className="text-muted-foreground">{COPY.visivel_loja}</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <Switch
                checked={item.ativo !== false}
                disabled={!admin || busy}
                onCheckedChange={(v) => void toggleFlag({ ativo: v })}
              />
              <span className="text-muted-foreground">{COPY.ativo}</span>
            </label>
          </div>
          {!admin ? <p className="text-muted-foreground">{COPY.somente_leitura_vendedor}</p> : null}
          {error && !editing && !openAdjust ? <p className="text-sm text-red-500">{error}</p> : null}
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{COPY.movimentos}</CardTitle>
        </CardHeader>
        <CardContent>
          {movimentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">{COPY.movimentos_empty}</p>
          ) : (
            <ul className="space-y-4">
              {movimentos.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {COPY.movement_type[m.type] ?? m.type}
                      <span className="ml-2 tabular-nums text-muted-foreground">
                        {movementQty(m) > 0 ? `+${movementQty(m)}` : movementQty(m)}
                      </span>
                    </p>
                    {movementMotivo(m) ? (
                      <p className="text-sm text-muted-foreground">{movementMotivo(m)}</p>
                    ) : null}
                    {m.pedido_id ? (
                      <p className="text-xs text-muted-foreground">Pedido {m.pedido_id}</p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">{formatDate(m.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </SaasPage>
  );
}
