/**
 * Add Padding Script
 * Adds white background padding around images to make them look better
 * 
 * Usage:
 *   Single file:  npx tsx scripts/add-padding.ts test_images/icon_01.png
 *   Whole folder: npx tsx scripts/add-padding.ts test_images/
 * 
 * Options:
 *   -p, --padding <px>   Padding in pixels (default: 20)
 *   -s, --square         Make output square (uses largest dimension)
 *   --bg <color>         Background color as hex (default: ffffff)
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

interface PaddingOptions {
  padding: number;
  makeSquare: boolean;
  bgColor: { r: number; g: number; b: number };
}

async function addPadding(inputPath: string, options: PaddingOptions): Promise<void> {
  const { padding, makeSquare, bgColor } = options;

  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  if (!width || !height) {
    throw new Error(`Could not read dimensions for ${inputPath}`);
  }

  let newWidth = width + padding * 2;
  let newHeight = height + padding * 2;

  // If making square, use the larger dimension
  if (makeSquare) {
    const maxDim = Math.max(newWidth, newHeight);
    newWidth = maxDim;
    newHeight = maxDim;
  }

  // Calculate position to center the original image
  const left = Math.floor((newWidth - width) / 2);
  const top = Math.floor((newHeight - height) / 2);

  // Create new image with padding
  await sharp({
    create: {
      width: newWidth,
      height: newHeight,
      channels: 4,
      background: { ...bgColor, alpha: 1 }
    }
  })
    .composite([
      {
        input: await image.toBuffer(),
        left,
        top
      }
    ])
    .png()
    .toFile(inputPath + '.tmp');

  // Replace original
  fs.renameSync(inputPath + '.tmp', inputPath);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 255, g: 255, b: 255 }; // default white
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
📏 Add Padding Tool

Usage:
  npx tsx scripts/add-padding.ts <file-or-folder> [options]

Options:
  -p, --padding <px>   Padding in pixels (default: 20)
  -s, --square         Make output square
  --bg <hex>           Background color (default: ffffff)

Examples:
  npx tsx scripts/add-padding.ts test_images/icon_01.png -p 30
  npx tsx scripts/add-padding.ts test_images/ -p 25 -s
`);
    process.exit(1);
  }

  const target = args[0];
  let padding = 20;
  let makeSquare = false;
  let bgColor = { r: 255, g: 255, b: 255 };

  // Parse options
  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '-p':
      case '--padding':
        padding = parseInt(args[++i]);
        break;
      case '-s':
      case '--square':
        makeSquare = true;
        break;
      case '--bg':
        bgColor = hexToRgb(args[++i]);
        break;
    }
  }

  const options: PaddingOptions = { padding, makeSquare, bgColor };

  console.log(`\n📏 Adding padding...`);
  console.log(`   Padding: ${padding}px`);
  console.log(`   Square: ${makeSquare ? 'yes' : 'no'}`);
  console.log(`   Background: rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})\n`);

  const stat = fs.statSync(target);

  if (stat.isDirectory()) {
    // Process all PNG files in directory
    const files = fs.readdirSync(target)
      .filter(f => f.endsWith('.png'))
      .map(f => path.join(target, f));

    for (const file of files) {
      await addPadding(file, options);
      console.log(`  ✅ ${path.basename(file)}`);
    }

    console.log(`\n✨ Done! Processed ${files.length} images`);
  } else {
    // Process single file
    await addPadding(target, options);
    console.log(`  ✅ ${path.basename(target)}`);
    console.log(`\n✨ Done!`);
  }
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});

