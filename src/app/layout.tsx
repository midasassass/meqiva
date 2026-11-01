import type { Metadata, Viewport } from "next";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "MEQIVA — know the price before you hand over the keys",
    template: "%s · MEQIVA",
  },
  description:
    "Compare itemised service estimates from verified garages in Gurugram — parts, labour and tax before you book. And the workshop software garages run on.",
  applicationName: "MEQIVA",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "MEQIVA",
    locale: "en_IN",
    title: "MEQIVA — know the price before you hand over the keys",
    description: "Itemised estimates from verified garages, and the workshop system behind them.",
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4f0" },
    { media: "(prefers-color-scheme: dark)", color: "#08191b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-card focus:bg-ink focus:px-4 focus:py-2 focus:text-bg">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
