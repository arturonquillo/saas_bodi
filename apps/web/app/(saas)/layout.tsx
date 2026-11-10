import { SaasChrome } from "@/ui/saas/SaasChrome";
import { SessionProvider } from "@/ui/session";
import { ColorModeProvider } from "@/ui/theme/ColorModeProvider";
import { TenantTheme } from "@/ui/theme/TenantTheme";

/** SaaS chrome. Never link /conta or billing. */
export default function SaasLayout({ children }: { children: React.ReactNode }) {
  return (
    <ColorModeProvider>
      <TenantTheme density="compact">
        <SessionProvider surface="saas">
          <SaasChrome>{children}</SaasChrome>
        </SessionProvider>
      </TenantTheme>
    </ColorModeProvider>
  );
}
