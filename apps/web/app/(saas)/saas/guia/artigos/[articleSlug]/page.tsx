import { GuiaUsuarioArticleScreen } from "@/ui/saas/GuiaUsuarioScreen";

export default async function Page({
  params,
}: {
  params: Promise<{ articleSlug: string }>;
}) {
  const { articleSlug } = await params;
  return <GuiaUsuarioArticleScreen articleSlug={articleSlug} />;
}
