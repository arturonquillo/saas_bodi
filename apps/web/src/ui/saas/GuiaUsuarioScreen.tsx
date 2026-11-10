"use client";

import {
  HelpPortalArticleScreen,
  HelpPortalHomeScreen,
} from "../public/HelpPortalScreens";
import { SEED_HELP_PORTAL_SLUG } from "../help/portal";

/** Operator guide inside SaaS chrome — same seeded portal as `/ajuda/:slug`. */
export function GuiaUsuarioHomeScreen() {
  return (
    <HelpPortalHomeScreen
      portalSlugProp={SEED_HELP_PORTAL_SLUG}
      linkBase="/saas/guia"
      eyebrow="Guia do usuário"
    />
  );
}

export function GuiaUsuarioArticleScreen({ articleSlug }: { articleSlug: string }) {
  return (
    <HelpPortalArticleScreen
      portalSlugProp={SEED_HELP_PORTAL_SLUG}
      articleSlugProp={articleSlug}
      linkBase="/saas/guia"
      eyebrow="Guia do usuário"
    />
  );
}
