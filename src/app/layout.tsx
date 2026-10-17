import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SettingsProvider } from "@/components/providers/SettingsProvider";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { KeyboardHelp } from "@/components/layout/KeyboardHelp";
import { SITE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: SITE.url,
  },
  twitter: { card: "summary", title: SITE.name, description: SITE.description },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9e7e1" },
    { media: "(prefers-color-scheme: dark)", color: "#26282c" },
  ],
};

// Applies the saved theme before first paint to avoid a light/dark flash.
const THEME_SCRIPT = `try{var s=JSON.parse(localStorage.getItem("tempo:settings:v1")||"{}");if(s.theme==="light"||s.theme==="dark")document.documentElement.setAttribute("data-theme",s.theme)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SettingsProvider>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <SettingsDialog />
          <KeyboardHelp />
        </SettingsProvider>
      </body>
    </html>
  );
}
