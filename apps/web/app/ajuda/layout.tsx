import { ColorModeToggle } from "@/ui/theme/ColorModeToggle";
import { ColorModeProvider } from "@/ui/theme/ColorModeProvider";
import { TenantTheme } from "@/ui/theme/TenantTheme";

/** Public Central de Ajuda — themed + dark-mode toggle (outside SaaS/Loja chrome). */
export default function AjudaLayout({ children }: { children: React.ReactNode }) {
  return (
    <ColorModeProvider>
      <TenantTheme density="comfortable">
        <div className="fixed top-3 right-3 z-40">
          <ColorModeToggle />
        </div>
        {children}
      </TenantTheme>
    </ColorModeProvider>
  );
}
