import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconDir = join(__dirname, '..', 'public', 'icon');

const sizes = [16, 32, 48, 128];

// Colors (RGBA)
const COLORS = {
  default: { r: 124, g: 58, b: 237, a: 255 },   // Purple #7c3aed
  loading: { r: 168, g: 85, b: 247, a: 255 },   // Lighter purple #a855f7
  success: { r: 34, g: 197, b: 94, a: 255 },    // Green #22c55e
};

function createIcon(size, color) {
  const png = new PNG({ width: size, height: size });

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;

      // Create a simple rounded square effect
      const centerX = size / 2;
      const centerY = size / 2;
      const radius = size * 0.4;
      const cornerRadius = size * 0.15;

      // Distance from center
      const dx = Math.abs(x - centerX);
      const dy = Math.abs(y - centerY);

      // Rounded rectangle check
      let inside = false;
      if (dx <= radius - cornerRadius && dy <= radius) {
        inside = true;
      } else if (dx <= radius && dy <= radius - cornerRadius) {
        inside = true;
      } else {
        // Check corners
        const cornerDx = dx - (radius - cornerRadius);
        const cornerDy = dy - (radius - cornerRadius);
        if (cornerDx > 0 && cornerDy > 0) {
          inside = Math.sqrt(cornerDx * cornerDx + cornerDy * cornerDy) <= cornerRadius;
        } else {
          inside = dx <= radius && dy <= radius;
        }
      }

      if (inside) {
        png.data[idx] = color.r;
        png.data[idx + 1] = color.g;
        png.data[idx + 2] = color.b;
        png.data[idx + 3] = color.a;
      } else {
        // Transparent
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
      }
    }
  }

  return PNG.sync.write(png);
}

mkdirSync(iconDir, { recursive: true });

// Generate all icons
for (const [state, color] of Object.entries(COLORS)) {
  for (const size of sizes) {
    const buffer = createIcon(size, color);
    const filename = state === 'default' ? `${size}.png` : `${state}-${size}.png`;
    writeFileSync(join(iconDir, filename), buffer);
    console.log(`Created: ${filename}`);
  }
}

console.log('\nIcons generated successfully!');
