import type { Metadata } from "next";
import { Manrope, Roboto_Mono } from "next/font/google";
import { LanguageProvider } from "@/context/LanguageContext";
import "./globals.css";

/**
 * Fonts mirror integratedbio.com: a geometric grotesk for text (their primary is
 * Aspekta, not on Google Fonts — Manrope is the fallback they declare) and
 * Roboto Mono for uppercase labels, nav items and CTAs.
 */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Edge Datacenter",
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
      className={`${manrope.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg-light text-text-base">
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
