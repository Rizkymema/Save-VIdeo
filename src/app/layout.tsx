import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { Toaster } from "@/components/ui/sonner";
import { id } from "@/i18n/dictionaries/id";
import { BOOT_SCRIPT, SITE_NAME, SITE_URL, THEME_COLORS } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Font mono hanya untuk angka kecil (ukuran file, durasi) → jangan di-preload agar tidak
// berebut bandwidth dengan aset yang menentukan LCP.
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: { default: id.meta.title, template: `%s · ${SITE_NAME}` },
  description: id.meta.description,
  keywords: id.meta.keywords,
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, email: false, address: false },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id-ID" className={`dark ${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        {/* Terapkan tema tersimpan & bahasa sebelum halaman dilukis (tanpa kedipan). */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh overflow-x-hidden bg-background font-sans text-foreground antialiased">
        {children}
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
