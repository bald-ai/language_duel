#!/usr/bin/env npx ts-node

/**
 * ============================================
 * 🛠️  LANGUAGE DUEL - DEV TOOLS
 * ============================================
 * 
 * COMMANDS:
 *   npx tsx scripts/dev-tools.ts themes            List all themes with IDs
 *   npx tsx scripts/dev-tools.ts words <themeId>   Show all words in a theme
 *   npx tsx scripts/dev-tools.ts stats             Database statistics
 * 
 * EXAMPLES:
 *   npx tsx scripts/dev-tools.ts themes
 *   npx tsx scripts/dev-tools.ts words js73x14f7fzrzttmj87jjmjnn57watwx
 *   npx tsx scripts/dev-tools.ts stats
 * 
 */

import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

// Load .env.local from project root
config({ path: ".env.local" });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "";

if (!CONVEX_URL) {
  console.error("❌ Missing NEXT_PUBLIC_CONVEX_URL in .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function listThemes() {
  console.log("\n📚 All Themes\n" + "=".repeat(50));
  
  const themes = await client.query(api.themes.getThemes, {});
  
  if (themes.length === 0) {
    console.log("No themes found.");
    return;
  }

  themes.forEach((theme, i) => {
    console.log(`\n${i + 1}. ${theme.name}`);
    console.log(`   ID: ${theme._id}`);
    console.log(`   Description: ${theme.description}`);
    console.log(`   Words: ${theme.words.length}`);
    console.log(`   Created: ${new Date(theme.createdAt).toLocaleDateString()}`);
  });
  
  console.log(`\n✅ Total: ${themes.length} themes`);
}

async function listWords(themeId: string) {
  console.log("\n📝 Words in Theme\n" + "=".repeat(50));
  
  const theme = await client.query(api.themes.getTheme, { 
    themeId: themeId as Id<"themes">
  });
  
  if (!theme) {
    console.error(`❌ Theme not found: ${themeId}`);
    return;
  }

  console.log(`\nTheme: ${theme.name}`);
  console.log(`Description: ${theme.description}\n`);
  console.log("-".repeat(50));

  theme.words.forEach((word, i) => {
    console.log(`\n${i + 1}. ${word.word} → ${word.answer}`);
    console.log(`   Wrong options: ${word.wrongAnswers.join(", ")}`);
  });

  console.log(`\n✅ Total: ${theme.words.length} words`);
}

async function showStats() {
  console.log("\n📊 Database Stats\n" + "=".repeat(50));
  
  const themes = await client.query(api.themes.getThemes, {});
  
  const totalWords = themes.reduce((sum, t) => sum + t.words.length, 0);
  const avgWordsPerTheme = themes.length > 0 
    ? (totalWords / themes.length).toFixed(1) 
    : 0;

  console.log(`\nThemes: ${themes.length}`);
  console.log(`Total words: ${totalWords}`);
  console.log(`Avg words/theme: ${avgWordsPerTheme}`);
  
  if (themes.length > 0) {
    const largest = themes.reduce((max, t) => 
      t.words.length > max.words.length ? t : max
    );
    const smallest = themes.reduce((min, t) => 
      t.words.length < min.words.length ? t : min
    );
    
    console.log(`\nLargest theme: "${largest.name}" (${largest.words.length} words)`);
    console.log(`Smallest theme: "${smallest.name}" (${smallest.words.length} words)`);
  }
}

// Main CLI handler
async function main() {
  const [command, arg] = process.argv.slice(2);

  switch (command) {
    case "themes":
      await listThemes();
      break;
    case "words":
      if (!arg) {
        console.error("❌ Please provide a theme ID");
        console.log("   Usage: npx ts-node scripts/dev-tools.ts words <themeId>");
        process.exit(1);
      }
      await listWords(arg);
      break;
    case "stats":
      await showStats();
      break;
    default:
      console.log(`
🛠️  Language Duel Dev Tools

Commands:
  themes          List all themes with their IDs
  words <id>      Show all words in a specific theme
  stats           Show database statistics

Examples:
  npx ts-node scripts/dev-tools.ts themes
  npx ts-node scripts/dev-tools.ts words jd7abc123...
  npx ts-node scripts/dev-tools.ts stats
      `);
  }
}

main().catch(console.error);

