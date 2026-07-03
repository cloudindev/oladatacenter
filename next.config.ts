import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      // Default: any local image without query string
      { pathname: "/**", search: "" },
      // Cache-busted brand assets (e.g. /ola-logo.png?v=2)
      { pathname: "/ola-logo.png", search: "?v=2" },
    ],
  },
};

export default nextConfig;
