"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "../../api";
import { COPY } from "../../copy";
import {
  createModeloEmail,
  deleteModeloEmail,
  listModelosEmail,
  patchModeloEmail,
} from "../../crm/phase-d";
import type { CrmEmailTemplateDto } from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

type Draft = {
  name: string;
  slug: string;
  subject_template: string;
  body_html_template: string;
};

const emptyDraft = (): Draft => ({
  name: "",
  slug: "",
  subject_template: "Olá {{nome}}",
  body_html_template:
    "<p>Olá {{nome}},</p><p>{{conteudo}}</p><p>— {{marca}}</p>",
});

export function ModelosEmailScreen() {
  const [items, setItems] = useState<CrmEmailTemplateDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmEmailTemplateDto | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setItems((await listModelosEmail()).items);
      setStatus("ok");
    } catch (err) {
      // Backend Phase D may not be merged yet — keep page usable for create UI.
      if (isApiError(err) && (err.status === 404 || err.status === 501)) {
        setItems([]);
        setStatus("ok");
        return;
      }
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft());
    setOpen(true);
  }

  function openEdit(item: CrmEmailTemplateDto) {
    setEditing(item);
    setDraft({
      name: item.name,
      slug: item.slug,
      subject_template: item.subject_template,
      body_html_template: item.body_html_template,
    });
    setOpen(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await patchModeloEmail(editing.id, draft);
      } else {
        await createModeloEmail(draft);
      }
      toast.success(COPY.actions.salvar);
      setOpen(false);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    try {
      await deleteModeloEmail(id);
      toast.success(COPY.actions.salvar);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SaasPage
      title={COPY.crm.modelos_email_title}
      actions={
        <Button type="button" onClick={openCreate}>
          {COPY.crm.modelos_email_create}
        </Button>
      }
    >
      <Alert className="mb-4">
        <AlertDescription>{COPY.crm.modelos_email_stub_note}</AlertDescription>
      </Alert>

      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{COPY.crm.modelos_email_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {COPY.crm.modelos_email_empty}
              </p>
            ) : (
              <ul className="space-y-4">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        <code>{item.slug}</code> · {item.subject_template}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(item)}>
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void onDelete(item.id)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar modelo" : COPY.crm.modelos_email_create}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={onSave}>
            <div>
              <Label htmlFor="me_name">Nome</Label>
              <Input
                id="me_name"
                className="mt-1"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="me_slug">Slug</Label>
              <Input
                id="me_slug"
                className="mt-1"
                value={draft.slug}
                onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="me_subject">Assunto</Label>
              <Input
                id="me_subject"
                className="mt-1"
                value={draft.subject_template}
                onChange={(e) => setDraft((d) => ({ ...d, subject_template: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="me_body">Corpo HTML</Label>
              <Textarea
                id="me_body"
                className="mt-1 font-mono text-xs"
                rows={8}
                value={draft.body_html_template}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, body_html_template: e.target.value }))
                }
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {COPY.actions.cancelar}
              </Button>
              <Button type="submit" disabled={busy}>
                {COPY.actions.salvar}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SaasPage>
  );
}
