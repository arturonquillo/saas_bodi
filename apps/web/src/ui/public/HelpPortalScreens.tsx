"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, asPage, isApiError } from "../api";
import { COPY } from "../copy";
import { formatDateOnly } from "../format";
import type {
  PublicHelpArticleDto,
  PublicHelpArticleListDto,
  PublicHelpCategoryDto,
  PublicHelpPortalDto,
} from "../crm/types";

function SimpleMarkdown({ source }: { source: string }) {
  const blocks = source.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={i} className="text-base font-semibold text-foreground">
              {trimmed.slice(4)}
            </h3>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={i} className="text-lg font-semibold text-foreground">
              {trimmed.slice(3)}
            </h2>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h1 key={i} className="text-xl font-semibold text-foreground">
              {trimmed.slice(2)}
            </h1>
          );
        }
        if (trimmed.startsWith("- ")) {
          const items = trimmed.split(/\n/).filter((l) => l.startsWith("- "));
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {items.map((item, j) => (
                <li key={j}>{item.slice(2)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

export function HelpPortalHomeScreen() {
  const { portalSlug } = useParams<{ portalSlug: string }>();
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get("categoria") || "";
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [committedQ, setCommittedQ] = useState(searchParams.get("q") || "");
  const [portal, setPortal] = useState<PublicHelpPortalDto | null>(null);
  const [categories, setCategories] = useState<PublicHelpCategoryDto[]>([]);
  const [articles, setArticles] = useState<PublicHelpArticleListDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "gone">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const p = await apiGet<PublicHelpPortalDto>(`/api/public/central-ajuda/${portalSlug}`);
      setPortal(p);
      const [cats, arts] = await Promise.all([
        apiGet(`/api/public/central-ajuda/${portalSlug}/categorias`).then((d) =>
          asPage<PublicHelpCategoryDto>(d).items,
        ),
        apiGet(
          `/api/public/central-ajuda/${portalSlug}/artigos?${new URLSearchParams({
            ...(categorySlug ? { category_slug: categorySlug } : {}),
            ...(committedQ.trim() ? { q: committedQ.trim() } : {}),
          }).toString()}`,
        ).then((d) => asPage<PublicHelpArticleListDto>(d).items),
      ]);
      setCategories(cats);
      setArticles(arts);
      setStatus("ok");
    } catch (err) {
      if (isApiError(err) && err.status === 404) setStatus("gone");
      else setStatus("error");
    }
  }, [portalSlug, categorySlug, committedQ]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-10">
      {status === "loading" ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : status === "gone" ? (
        <p className="text-sm text-muted-foreground">{COPY.crm.ajuda_public_gone}</p>
      ) : status === "error" ? (
        <div className="space-y-3">
          <p className="text-sm text-red-500">{COPY.load_fail}</p>
          <Button type="button" variant="outline" onClick={() => void load()}>
            {COPY.retry}
          </Button>
        </div>
      ) : (
        <>
          <header className="mb-8 space-y-2">
            <p className="text-sm text-muted-foreground">{COPY.crm.ajuda_public_eyebrow}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {portal?.name}
            </h1>
            {portal?.header_text ? (
              <p className="text-base text-muted-foreground">{portal.header_text}</p>
            ) : null}
          </header>

          {portal?.homepage_md ? (
            <section className="mb-8">
              <SimpleMarkdown source={portal.homepage_md} />
            </section>
          ) : null}

          <form
            className="mb-6 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setCommittedQ(q);
            }}
          >
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={COPY.crm.ajuda_search_placeholder}
              aria-label={COPY.crm.ajuda_search_placeholder}
            />
            <Button type="submit">{COPY.crm.ajuda_search}</Button>
          </form>

          {categories.length > 0 ? (
            <nav className="mb-8 flex flex-wrap gap-2" aria-label="Categorias">
              <Button
                type="button"
                size="sm"
                variant={!categorySlug ? "default" : "outline"}
                asChild
              >
                <Link href={`/ajuda/${portalSlug}`}>{COPY.filter_todos}</Link>
              </Button>
              {categories.map((c) => (
                <Button
                  key={c.slug}
                  type="button"
                  size="sm"
                  variant={categorySlug === c.slug ? "default" : "outline"}
                  asChild
                >
                  <Link href={`/ajuda/${portalSlug}?categoria=${encodeURIComponent(c.slug)}`}>
                    {c.name}
                    {typeof c.published_count === "number" ? ` (${c.published_count})` : ""}
                  </Link>
                </Button>
              ))}
            </nav>
          ) : null}

          {articles.length === 0 ? (
            <p className="text-sm text-muted-foreground">{COPY.crm.ajuda_public_empty}</p>
          ) : (
            <ul className="divide-y divide-border border-y">
              {articles.map((a) => {
                const cat = categories.find((c) => c.id === a.category_id);
                return (
                  <li key={a.id || a.slug}>
                    <Link
                      href={`/ajuda/${portalSlug}/artigos/${encodeURIComponent(a.slug)}`}
                      className="block py-4 hover:bg-muted/40"
                    >
                      <p className="font-medium text-foreground">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {cat?.name || ""}
                        {a.published_at ? ` · ${formatDateOnly(a.published_at)}` : ""}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

export function HelpPortalArticleScreen() {
  const { portalSlug, articleSlug } = useParams<{
    portalSlug: string;
    articleSlug: string;
  }>();
  const [portal, setPortal] = useState<PublicHelpPortalDto | null>(null);
  const [article, setArticle] = useState<PublicHelpArticleDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "gone">("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [p, a] = await Promise.all([
        apiGet<PublicHelpPortalDto>(`/api/public/central-ajuda/${portalSlug}`),
        apiGet<PublicHelpArticleDto>(
          `/api/public/central-ajuda/${portalSlug}/artigos/${articleSlug}`,
        ),
      ]);
      setPortal(p);
      setArticle(a);
      setStatus("ok");
    } catch (err) {
      if (isApiError(err) && err.status === 404) setStatus("gone");
      else setStatus("error");
    }
  }, [portalSlug, articleSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-10">
      {status === "loading" ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : status === "gone" ? (
        <p className="text-sm text-muted-foreground">{COPY.crm.ajuda_public_gone}</p>
      ) : status === "error" ? (
        <div className="space-y-3">
          <p className="text-sm text-red-500">{COPY.load_fail}</p>
          <Button type="button" variant="outline" onClick={() => void load()}>
            {COPY.retry}
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href={`/ajuda/${portalSlug}`}>← {portal?.name || COPY.crm.ajuda_public_eyebrow}</Link>
            </Button>
          </div>
          <header className="mb-8 space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">{article?.title}</h1>
            {article?.published_at ? (
              <p className="text-xs text-muted-foreground">
                {formatDateOnly(article.published_at)}
              </p>
            ) : null}
          </header>
          {article?.content_html ? (
            <div
              className="prose prose-sm max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: article.content_html }}
            />
          ) : article?.content_md ? (
            <SimpleMarkdown source={article.content_md} />
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </>
      )}
    </main>
  );
}
