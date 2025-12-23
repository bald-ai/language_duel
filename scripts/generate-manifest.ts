/**
 * Generates public/manifest.json from the centralized theme configuration.
 * Run with: npx tsx scripts/generate-manifest.ts
 * 
 * This ensures PWA manifest colors stay in sync with lib/theme.ts.
 */

import * as fs from "fs";
import * as path from "path";
import { themes, DEFAULT_THEME_NAME } from "../lib/theme";

const defaultTheme = themes[DEFAULT_THEME_NAME].colors;

const manifest = {
  name: "Language Duel",
  short_name: "LangDuel",
  description: "Language learning app for couples",
  start_url: "/",
  display: "standalone",
  background_color: defaultTheme.background.DEFAULT,
  theme_color: defaultTheme.primary.DEFAULT,
  icons: [
    {
      src: "/icons/icon-192x192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any maskable",
    },
    {
      src: "/icons/icon-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable",
    },
  ],
};

const outputPath = path.join(__dirname, "../public/manifest.json");
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`✓ Generated manifest.json with theme colors:`);
console.log(`  background_color: ${manifest.background_color}`);
console.log(`  theme_color: ${manifest.theme_color}`);

