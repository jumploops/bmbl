import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconDir = join(__dirname, '..', 'public', 'icon');

const sizes = [16, 32, 48, 128];

// Create a minimal valid 1x1 PNG (placeholder)
function createPlaceholderPng() {
  const pngData = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x01,
    0x08, 0x02,
    0x00, 0x00, 0x00,
    0x90, 0x77, 0x53, 0xde,
    0x00, 0x00, 0x00, 0x0c,
    0x49, 0x44, 0x41, 0x54,
    0x08, 0xd7, 0x63, 0xd8, 0xd0, 0xd2, 0x06, 0x00,
    0x01, 0xc4, 0x00, 0xc3,
    0x4e, 0xe9, 0x6b, 0x84,
    0x00, 0x00, 0x00, 0x00,
    0x49, 0x45, 0x4e, 0x44,
    0xae, 0x42, 0x60, 0x82
  ]);
  return pngData;
}

mkdirSync(iconDir, { recursive: true });

const png = createPlaceholderPng();

// Default icons
for (const size of sizes) {
  writeFileSync(join(iconDir, `${size}.png`), png);
  console.log(`Created placeholder icon: ${size}.png`);
}

// Loading icons
for (const size of sizes) {
  writeFileSync(join(iconDir, `loading-${size}.png`), png);
  console.log(`Created placeholder icon: loading-${size}.png`);
}

// Success icons
for (const size of sizes) {
  writeFileSync(join(iconDir, `success-${size}.png`), png);
  console.log(`Created placeholder icon: success-${size}.png`);
}

console.log('Placeholder icons created. Replace with proper icons before release.');
