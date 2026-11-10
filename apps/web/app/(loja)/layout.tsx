import { CartProvider } from "@/ui/cart";
import { SessionProvider } from "@/ui/session";
import { StoreChrome } from "@/ui/store/StoreChrome";
import { ColorModeProvider } from "@/ui/theme/ColorModeProvider";
import { TenantTheme } from "@/ui/theme/TenantTheme";

export default function LojaLayout({ children }: { children: React.ReactNode }) {
  return (
    <ColorModeProvider>
      <TenantTheme density="comfortable">
        <SessionProvider surface="loja">
          <CartProvider>
            <StoreChrome>{children}</StoreChrome>
          </CartProvider>
        </SessionProvider>
      </TenantTheme>
    </ColorModeProvider>
  );
}
