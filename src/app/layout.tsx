import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { LanguageProvider } from "@/context/LanguageContext";
import "./globals.css";

/**
 * Fonts: Aspekta (from integratedbio.com) + Geist (original site neo-grotesk) for text,
 * Montserrat Black for heavy display headlines, and
 * Roboto Mono for uppercase labels, nav items and CTAs.
 */
// All three fonts are self-hosted (latin subset, variable). next/font/google downloads
// them during the build: Turbopack 16.2.7 cannot resolve Montserrat's URLs on Linux, and
// any hiccup reaching Google fails the whole build ("Error while requesting resource").
const geistSans = localFont({
  src: "./fonts/geist-latin-variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const montserrat = localFont({
  src: "./fonts/montserrat-latin-variable.woff2",
  variable: "--font-montserrat",
  weight: "800 900",
  display: "swap",
});

const robotoMono = localFont({
  src: "./fonts/roboto-mono-latin-variable.woff2",
  variable: "--font-roboto-mono",
  weight: "400 500",
  display: "swap",
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
