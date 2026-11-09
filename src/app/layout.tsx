import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { AccountProvider } from "@/components/providers/AccountProvider";
import { SettingsProvider } from "@/components/providers/SettingsProvider";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { KeyboardHelp } from "@/components/layout/KeyboardHelp";
import { PwaRegister } from "@/components/layout/PwaRegister";
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
  icons: { icon: "/icon.svg", apple: "/icons/icon-192.png" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: SITE.name, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9e7e1" },
    { media: "(prefers-color-scheme: dark)", color: "#26282c" },
  ],
};

// Applies the saved theme before first paint to avoid a light/dark flash.

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
      </head>
      <body className="flex min-h-dvh flex-col antialiased max-md:pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <AccountProvider>
        <SettingsProvider>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <SettingsDialog />
          <KeyboardHelp />
          <PwaRegister />
        </SettingsProvider>
        </AccountProvider>
      </body>
    </html>
  );
}
