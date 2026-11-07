import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/cloud/vps", destination: "/vps", permanent: true },
      { source: "/cloud/vps/:path*", destination: "/vps/:path*", permanent: true },
      // Links already sent in emails (renewal, reminder, deletion warning).
      { source: "/app/facturas", destination: "/app/billing", permanent: false },
      { source: "/app/facturas/:path*", destination: "/app/billing", permanent: false },
      {
        source: "/app/facturacion/metodos-de-pago",
        destination: "/app/billing/metodos-de-pago",
        permanent: false,
      },
    ];
  },
  images: {
    localPatterns: [
      // Default: any local image without query string
      { pathname: "/**", search: "" },
      // Cache-busted brand assets (e.g. /ola-logo.png?v=2)
      { pathname: "/ola-logo.png", search: "?v=2" },
      { pathname: "/cloud.webp", search: "?v=2" },
    ],
  },
};

export default nextConfig;
