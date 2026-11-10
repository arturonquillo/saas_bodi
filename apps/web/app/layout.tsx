import type { Metadata } from "next";
import { Archivo, IBM_Plex_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { cn } from "@/lib/utils";
import { COLOR_MODE_BOOT_SCRIPT } from "@/ui/theme/color-mode";

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-display",
});

const plex = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Casa dos Frios",
  description: "Frios e carnes no atacado — loja e SaaS CRM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={cn(archivo.variable, plex.variable, "font-sans")}
      style={{ ["--font-ui" as string]: "var(--font-body)" }}
      suppressHydrationWarning
    >
      <body>
        <Script id="sf-color-mode" strategy="beforeInteractive">
          {COLOR_MODE_BOOT_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
