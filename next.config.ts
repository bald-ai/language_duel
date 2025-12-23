import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  // Empty turbopack config silences Next.js 16 warning about webpack config from PWA plugin.
  // Note: Production builds MUST use --webpack flag for PWA service worker generation.
  // See package.json "build" script.
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.clerk.dev",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "*.clerk.accounts.dev",
      },
    ],
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
} as Parameters<typeof withPWA>[0])(nextConfig);
