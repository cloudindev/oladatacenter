import type { Metadata } from "next";
import { Geist, Roboto_Mono } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import { LanguageProvider } from "@/context/LanguageContext";
import "./globals.css";

/**
 * Fonts: Aspekta (from integratedbio.com) + Geist (original site neo-grotesk) for text,
 * Montserrat Black for heavy display headlines, and
 * Roboto Mono for uppercase labels, nav items and CTAs.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Self-hosted: on Linux builds (Vercel, CI) Turbopack 16.2.7 fails to resolve the
// next/font/google URLs for Montserrat ("queries have exactly one entry").
const montserrat = localFont({
  src: "./fonts/montserrat-latin-variable.woff2",
  variable: "--font-montserrat",
  weight: "800 900",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "OLA DC - Edge Green Datacenter",
  description: "Datacenter, dedicated servers and sovereign AI cloud infrastructure engineered in Spain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${montserrat.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg-light text-text-base">
        <LanguageProvider>
          {children}
        </LanguageProvider>
        <Script
          src="https://app.olabrain.com/widget.js"
          data-agent="dd2560d8-188b-4ba7-af47-2badbe12663a"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
