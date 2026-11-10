/** Seed portal slug for Casa dos Frios (Phase C help center). */
export const SEED_HELP_PORTAL_SLUG = "casa-dos-frios-ajuda";

export function helpPortalHomePath(portalSlug = SEED_HELP_PORTAL_SLUG) {
  return `/ajuda/${portalSlug}`;
}

export function helpArticlePath(articleSlug: string, portalSlug = SEED_HELP_PORTAL_SLUG) {
  return `/ajuda/${portalSlug}/artigos/${encodeURIComponent(articleSlug)}`;
}

/** In-app SaaS operator guide (same published articles as the public portal). */
export const SAAS_GUIA_HOME = "/saas/guia";

export function saasGuiaArticlePath(articleSlug: string) {
  return `/saas/guia/artigos/${encodeURIComponent(articleSlug)}`;
}
