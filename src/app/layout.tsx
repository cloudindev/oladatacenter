import type { Metadata } from "next";
import { Manrope, Montserrat, Roboto_Mono } from "next/font/google";
import { LanguageProvider } from "@/context/LanguageContext";
import "./globals.css";

/**
 * Fonts mirror integratedbio.com: a geometric grotesk for text (their primary is
 * Aspekta, not on Google Fonts — Manrope is the fallback they declare),
 * Montserrat Black for heavy display headlines, and
 * Roboto Mono for uppercase labels, nav items and CTAs.
 */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["800", "900"],
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
      className={`${manrope.variable} ${montserrat.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg-light text-text-base">
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
