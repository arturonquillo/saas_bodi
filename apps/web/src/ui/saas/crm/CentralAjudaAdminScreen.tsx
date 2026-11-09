"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiSend, asPage, isApiError } from "../../api";
import { COPY } from "../../copy";
import { formatDate } from "../../format";
import { articleStatusLabel, slugify } from "../../crm/phase-c";
import { putPortalDominio, verifyPortalDominio } from "../../crm/phase-e";
import type {
  ArticleStatus,
  CrmHelpArticleDto,
  CrmHelpCategoryDto,
  CrmPortalDto,
} from "../../crm/types";
import { SaasPage } from "../../layout";
import { ErrorState, TableSkeleton } from "../../states";

const emptyPortal = (): CrmPortalDto => ({
  id: "",
  name: "",
  slug: "",
  header_text: "",
  homepage_md: "",
  locale: "pt-BR",
  enabled: false,
  custom_domain: null,
  custom_domain_verified: false,
});

export function CentralAjudaAdminScreen() {
  const [portal, setPortal] = useState<CrmPortalDto>(emptyPortal);
  const [categories, setCategories] = useState<CrmHelpCategoryDto[]>([]);
  const [articles, setArticles] = useState<CrmHelpArticleDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [artOpen, setArtOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<CrmHelpArticleDto | null>(null);
  const [artStatusFilter, setArtStatusFilter] = useState<string>("all");
  const [domainInput, setDomainInput] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [p, cats, arts] = await Promise.all([
        apiGet<CrmPortalDto | null>("/api/saas/crm/central-ajuda/portal").catch(() => null),
        apiGet("/api/saas/crm/central-ajuda/categorias").then((d) =>
          asPage<CrmHelpCategoryDto>(d).items,
        ),
        apiGet(
          `/api/saas/crm/central-ajuda/artigos${
            artStatusFilter !== "all" ? `?status=${artStatusFilter}` : ""
          }`,
        ).then((d) => asPage<CrmHelpArticleDto>(d).items),
      ]);
      const nextPortal = {
        ...emptyPortal(),
        ...(p ?? {}),
        locale: p?.locale || "pt-BR",
        enabled: p?.enabled ?? false,
      };
      setPortal(nextPortal);
      setDomainInput(nextPortal.custom_domain ?? "");
      setCategories(cats);
      setArticles(arts);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, [artStatusFilter]);

  async function saveDomain(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await putPortalDominio(domainInput.trim() || null);
      if (saved && typeof saved === "object") {
        setPortal((p) => ({ ...p, ...(saved as CrmPortalDto) }));
      } else {
        setPortal((p) => ({
          ...p,
          custom_domain: domainInput.trim() || null,
          custom_domain_verified: false,
        }));
      }
      toast.success(COPY.actions.salvar);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function verifyDomain() {
    setBusy(true);
    try {
      const res = await verifyPortalDominio();
      toast.success(
        res.message ||
          (res.verified || res.status === "verified"
            ? "Domínio verificado (stub)"
            : "Verificação enfileirada (stub)"),
      );
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  async function savePortal(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await apiSend<CrmPortalDto>("/api/saas/crm/central-ajuda/portal", "PUT", {
        name: portal.name.trim(),
        slug: portal.slug.trim() || slugify(portal.name),
        header_text: portal.header_text?.trim() || null,
        homepage_md: portal.homepage_md?.trim() || null,
        enabled: portal.enabled,
        locale: "pt-BR",
      });
      setPortal({ ...emptyPortal(), ...saved, locale: "pt-BR" });
      toast.success(COPY.actions.salvar);
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function createCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    try {
      await apiSend("/api/saas/crm/central-ajuda/categorias", "POST", {
        name,
        slug: String(fd.get("slug") || "").trim() || slugify(name),
        description: String(fd.get("description") || "").trim() || null,
        position: Number(fd.get("position") || categories.length),
      });
      setCatOpen(false);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(id: string) {
    try {
      await apiSend(`/api/saas/crm/central-ajuda/categorias/${id}`, "DELETE");
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  function openArticle(article?: CrmHelpArticleDto) {
    setEditingArticle(article ?? null);
    setArtOpen(true);
  }

  async function saveArticle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") || "").trim();
    const body = {
      title,
      slug: String(fd.get("slug") || "").trim() || slugify(title),
      category_id: String(fd.get("category_id") || ""),
      content_md: String(fd.get("content_md") || ""),
      status: (String(fd.get("status") || "draft") as ArticleStatus) || "draft",
    };
    try {
      if (editingArticle) {
        await apiSend(`/api/saas/crm/central-ajuda/artigos/${editingArticle.id}`, "PATCH", body);
      } else {
        await apiSend("/api/saas/crm/central-ajuda/artigos", "POST", body);
      }
      setArtOpen(false);
      setEditingArticle(null);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    } finally {
      setBusy(false);
    }
  }

  async function publishArticle(id: string) {
    try {
      await apiSend(`/api/saas/crm/central-ajuda/artigos/${id}/publicar`, "POST");
      toast.success(COPY.crm.ajuda_published);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  async function unpublishArticle(id: string) {
    try {
      await apiSend(`/api/saas/crm/central-ajuda/artigos/${id}/despublicar`, "POST");
      toast.success(COPY.crm.ajuda_unpublished);
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  async function deleteArticle(id: string) {
    try {
      await apiSend(`/api/saas/crm/central-ajuda/artigos/${id}`, "DELETE");
      void load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : COPY.save_fail);
    }
  }

  const publicUrl = portal.slug ? `/ajuda/${portal.slug}` : null;

  return (
    <SaasPage
      title={COPY.crm.ajuda_title}
      actions={
        publicUrl ? (
          <Button type="button" variant="outline" asChild>
            <Link href={publicUrl} target="_blank">
              {COPY.crm.ajuda_open_public}
            </Link>
          </Button>
        ) : null
      }
    >
      {status === "loading" ? (
        <TableSkeleton />
      ) : status === "error" ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <Tabs defaultValue="portal">
          <TabsList>
            <TabsTrigger value="portal">{COPY.crm.ajuda_portal_tab}</TabsTrigger>
            <TabsTrigger value="categorias">{COPY.crm.ajuda_categorias_tab}</TabsTrigger>
            <TabsTrigger value="artigos">{COPY.crm.ajuda_artigos_tab}</TabsTrigger>
          </TabsList>

          <TabsContent value="portal" className="mt-4">
            <Card className="max-w-xl">
              <CardHeader>
                <CardTitle>{COPY.crm.ajuda_portal_tab}</CardTitle>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <AlertDescription>{COPY.crm.ajuda_locale_note}</AlertDescription>
                </Alert>
                <form className="space-y-3" onSubmit={savePortal}>
                  <div>
                    <Label htmlFor="portal-name">{COPY.nome}</Label>
                    <Input
                      id="portal-name"
                      className="mt-1"
                      required
                      value={portal.name}
                      onChange={(e) => setPortal((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="portal-slug">Slug</Label>
                    <Input
                      id="portal-slug"
                      className="mt-1 font-mono text-sm"
                      required
                      value={portal.slug}
                      onChange={(e) => setPortal((p) => ({ ...p, slug: e.target.value }))}
                      onBlur={() =>
                        setPortal((p) => ({
                          ...p,
                          slug: p.slug.trim() || slugify(p.name),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="portal-header">Cabeçalho</Label>
                    <Input
                      id="portal-header"
                      className="mt-1"
                      value={portal.header_text ?? ""}
                      onChange={(e) => setPortal((p) => ({ ...p, header_text: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="portal-home">Homepage (markdown)</Label>
                    <Textarea
                      id="portal-home"
                      className="mt-1"
                      rows={4}
                      value={portal.homepage_md ?? ""}
                      onChange={(e) => setPortal((p) => ({ ...p, homepage_md: e.target.value }))}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={portal.enabled}
                      onCheckedChange={(v) => setPortal((p) => ({ ...p, enabled: Boolean(v) }))}
                    />
                    {COPY.crm.ajuda_enabled}
                  </label>
                  <p className="text-xs text-muted-foreground">Locale: pt-BR</p>
                  <Button type="submit" disabled={busy}>
                    {COPY.actions.salvar}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="mt-6 max-w-xl">
              <CardHeader>
                <CardTitle>{COPY.crm.hc_domain_title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">{COPY.crm.hc_domain_hint}</p>
                <form className="space-y-3" onSubmit={saveDomain}>
                  <div>
                    <Label htmlFor="portal-domain">Domínio</Label>
                    <Input
                      id="portal-domain"
                      className="mt-1"
                      placeholder="ajuda.exemplo.com.br"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {portal.custom_domain_verified ? "Verificado" : "Não verificado"}
                    </Badge>
                    {portal.custom_domain ? (
                      <span className="text-sm text-muted-foreground">{portal.custom_domain}</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={busy}>
                      {COPY.actions.salvar}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || !portal.custom_domain}
                      onClick={() => void verifyDomain()}
                    >
                      {COPY.crm.hc_domain_verify}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categorias" className="mt-4">
            <div className="mb-4">
              <Button type="button" onClick={() => setCatOpen(true)}>
                {COPY.crm.ajuda_category_create}
              </Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>{COPY.crm.ajuda_categorias_tab}</CardTitle>
              </CardHeader>
              <CardContent>
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{COPY.crm.ajuda_categories_empty}</p>
                ) : (
                  <ul className="space-y-3">
                    {categories.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{c.slug}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void deleteCategory(c.id)}
                        >
                          Excluir
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="artigos" className="mt-4">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Button type="button" onClick={() => openArticle()}>
                {COPY.crm.ajuda_article_create}
              </Button>
              <Select value={artStatusFilter} onValueChange={setArtStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{COPY.filter_todos}</SelectItem>
                  <SelectItem value="draft">{articleStatusLabel("draft")}</SelectItem>
                  <SelectItem value="published">{articleStatusLabel("published")}</SelectItem>
                  <SelectItem value="archived">{articleStatusLabel("archived")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>{COPY.crm.ajuda_artigos_tab}</CardTitle>
              </CardHeader>
              <CardContent>
                {articles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{COPY.crm.ajuda_articles_empty}</p>
                ) : (
                  <ul className="space-y-4">
                    {articles.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{a.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.slug}
                            {a.published_at ? ` · ${formatDate(a.published_at)}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={a.status === "published" ? "default" : "secondary"}>
                            {articleStatusLabel(String(a.status))}
                          </Badge>
                          <Button type="button" size="sm" variant="outline" onClick={() => openArticle(a)}>
                            Editar
                          </Button>
                          {a.status === "published" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void unpublishArticle(a.id)}
                            >
                              {COPY.crm.ajuda_unpublish}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void publishArticle(a.id)}
                            >
                              {COPY.crm.ajuda_publish}
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void deleteArticle(a.id)}
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
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{COPY.crm.ajuda_category_create}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={createCategory}>
            <div>
              <Label htmlFor="cat-name">{COPY.nome}</Label>
              <Input id="cat-name" name="name" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="cat-slug">Slug</Label>
              <Input id="cat-slug" name="slug" className="mt-1 font-mono text-sm" />
            </div>
            <div>
              <Label htmlFor="cat-desc">Descrição</Label>
              <Textarea id="cat-desc" name="description" rows={2} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="cat-pos">Posição</Label>
              <Input
                id="cat-pos"
                name="position"
                type="number"
                className="mt-1"
                defaultValue={categories.length}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCatOpen(false)}>
                {COPY.actions.cancelar}
              </Button>
              <Button type="submit" disabled={busy}>
                {COPY.actions.criar}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={artOpen}
        onOpenChange={(v) => {
          setArtOpen(v);
          if (!v) setEditingArticle(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingArticle ? "Editar artigo" : COPY.crm.ajuda_article_create}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={saveArticle}>
            <div>
              <Label htmlFor="art-title">Título</Label>
              <Input
                id="art-title"
                name="title"
                required
                className="mt-1"
                defaultValue={editingArticle?.title ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="art-slug">Slug</Label>
              <Input
                id="art-slug"
                name="slug"
                className="mt-1 font-mono text-sm"
                defaultValue={editingArticle?.slug ?? ""}
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <select
                name="category_id"
                required
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                defaultValue={editingArticle?.category_id ?? categories[0]?.id ?? ""}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select
                name="status"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                defaultValue={editingArticle?.status ?? "draft"}
              >
                <option value="draft">{articleStatusLabel("draft")}</option>
                <option value="published">{articleStatusLabel("published")}</option>
                <option value="archived">{articleStatusLabel("archived")}</option>
              </select>
            </div>
            <div>
              <Label htmlFor="art-md">Conteúdo (markdown)</Label>
              <Textarea
                id="art-md"
                name="content_md"
                required
                rows={10}
                className="mt-1 font-mono text-sm"
                defaultValue={editingArticle?.content_md ?? ""}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setArtOpen(false)}>
                {COPY.actions.cancelar}
              </Button>
              <Button type="submit" disabled={busy || categories.length === 0}>
                {COPY.actions.salvar}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SaasPage>
  );
}
