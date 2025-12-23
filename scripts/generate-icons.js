/* eslint-disable @typescript-eslint/no-require-imports */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateIcon(size, outputPath) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background - dark theme color
  ctx.fillStyle = '#3C34C5';
  ctx.fillRect(0, 0, size, size);

  // Add a subtle gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#3C34C5');
  gradient.addColorStop(1, '#2A2489');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Add a border ring with CTA color
  const borderWidth = Math.max(4, Math.floor(size / 48));
  ctx.strokeStyle = '#DE7321';
  ctx.lineWidth = borderWidth;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - borderWidth / 2, 0, Math.PI * 2);
  ctx.stroke();

  // Draw "LD" text
  const fontSize = Math.floor(size * 0.5);
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LD', size / 2, size / 2);

  // Save as PNG
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated ${outputPath}`);
}

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate both sizes
generateIcon(192, path.join(iconsDir, 'icon-192x192.png'));
generateIcon(512, path.join(iconsDir, 'icon-512x512.png'));

console.log('PWA icons generated successfully!');
