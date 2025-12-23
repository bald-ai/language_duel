/**
 * Grid-Based Icon Extraction (Simple)
 * Just slices image into equal cells - fast and simple!
 * 
 * Usage: npx tsx scripts/extract-grid.ts <image> -r <rows> -c <cols>
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

async function extractGrid(
  inputPath: string,
  outputDir: string,
  rows: number,
  cols: number
): Promise<string[]> {
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const metadata = await sharp(inputPath).metadata();
  const { width, height } = metadata;

  if (!width || !height) {
    throw new Error('Could not read image dimensions');
  }

  console.log(`📷 Image: ${width}x${height}`);

  const cellWidth = Math.floor(width / cols);
  const cellHeight = Math.floor(height / rows);

  console.log(`📐 Grid: ${rows}×${cols} (cells: ${cellWidth}x${cellHeight}px)`);

  const outputPaths: string[] = [];
  let iconNum = 1;

  // Trim a few pixels from edges to remove grid lines
  const trim = 2;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellWidth + trim;
      const y = row * cellHeight + trim;
      const w = cellWidth - trim * 2;
      const h = cellHeight - trim * 2;

      const outputPath = path.join(outputDir, `icon_${String(iconNum).padStart(2, '0')}.png`);

      await sharp(inputPath)
        .extract({ left: x, top: y, width: w, height: h })
        .png()
        .toFile(outputPath);

      console.log(`  ✅ icon_${String(iconNum).padStart(2, '0')}.png`);
      outputPaths.push(outputPath);
      iconNum++;
    }
  }

  return outputPaths;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 5) {
    console.log(`
📐 Grid Extraction

Usage: npx tsx scripts/extract-grid.ts <image> -r <rows> -c <cols> [-o <output>]

Example:
  npx tsx scripts/extract-grid.ts icons.png -r 4 -c 5
`);
    process.exit(1);
  }

  const inputPath = args[0];
  let outputDir = 'test_images';
  let rows = 0, cols = 0;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '-r') rows = parseInt(args[++i]);
    if (args[i] === '-c') cols = parseInt(args[++i]);
    if (args[i] === '-o') outputDir = args[++i];
  }

  if (!rows || !cols) {
    console.error('❌ Must specify -r <rows> and -c <cols>');
    process.exit(1);
  }

  console.log(`\n🚀 Extracting ${rows}×${cols} grid...\n`);

  const extracted = await extractGrid(inputPath, outputDir, rows, cols);
  console.log(`\n✨ Done! ${extracted.length} icons → ${outputDir}/`);
}

main();
