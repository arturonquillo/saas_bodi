"use client";

import { useCallback, useEffect, useState } from "react";
import { isAdmin } from "@saas-frota/shared";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet, apiSend, asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import { ATTRIBUTE_TYPES } from "../../crm/phase-b";
import type { AttributeModel, CrmAttributeDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { useSession } from "../../session";
import { ErrorState, TableSkeleton } from "../../states";

export function AtributosScreen() {
  const { session } = useSession();
  const admin = isAdmin(session?.saas_role);
  const [model, setModel] = useState<AttributeModel>("conversation");
  const [items, setItems] = useState<CrmAttributeDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems(
        asPage<CrmAttributeDto>(
          await apiGet(`/api/saas/crm/atributos?model=${encodeURIComponent(model)}`),
        ).items,
      );
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [model]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!admin) return;
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const listRaw = String(fd.get("list_values") || "").trim();
    try {
      await apiSend("/api/saas/crm/atributos", "POST", {
        attribute_model: model,
        attribute_display_type: fd.get("attribute_display_type"),
        attribute_key: String(fd.get("attribute_key") || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_"),
        attribute_display_name: fd.get("attribute_display_name"),
        attribute_values: listRaw
          ? listRaw.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
      });
      setOpen(false);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!admin) return;
    try {
      await apiSend(`/api/saas/crm/atributos/${id}`, "DELETE");
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  return (
    <SaasPage
      title={COPY.crm.atributos_title}
      actions={
        admin ? (
          <Button type="button" onClick={() => setOpen(true)}>
            {COPY.crm.atributo_create}
          </Button>
        ) : null
      }
    >
      <Tabs
        value={model}
        onValueChange={(v) => setModel(v as AttributeModel)}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="conversation">{COPY.crm.atributo_model_conversation}</TabsTrigger>
          <TabsTrigger value="contact">{COPY.crm.atributo_model_contact}</TabsTrigger>
        </TabsList>
        <TabsContent value={model} className="mt-4">
          {status === "loading" ? (
            <TableSkeleton />
          ) : status === "error" ? (
            <ErrorState onRetry={() => void load()} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{COPY.crm.atributos_title}</CardTitle>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <h3 className="mb-2 text-lg font-semibold">{COPY.crm.atributos_empty}</h3>
                    {admin ? (
                      <Button type="button" onClick={() => setOpen(true)}>
                        {COPY.crm.atributo_create}
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{item.attribute_display_name}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {item.attribute_key}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{String(item.attribute_display_type)}</Badge>
                          {admin ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => void onDelete(item.id)}
                            >
                              Excluir
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{COPY.crm.atributo_create}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={onCreate}>
            <div>
              <Label htmlFor="attr-name">Nome de exibição</Label>
              <Input id="attr-name" name="attribute_display_name" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="attr-key">Chave</Label>
              <Input
                id="attr-key"
                name="attribute_key"
                required
                className="mt-1 font-mono"
                placeholder="ex: segmento"
              />
            </div>
            <div>
              <Label htmlFor="attr-type">Tipo</Label>
              <select
                id="attr-type"
                name="attribute_display_type"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                defaultValue="text"
              >
                {ATTRIBUTE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="attr-list">Opções (lista, separadas por vírgula)</Label>
              <Input id="attr-list" name="list_values" className="mt-1" placeholder="A, B, C" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {COPY.actions.cancelar}
              </Button>
              <Button type="submit" disabled={busy}>
                {COPY.actions.criar}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SaasPage>
  );
}
