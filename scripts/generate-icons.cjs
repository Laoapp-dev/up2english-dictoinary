const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

/**
 * @param size        output PNG dimensions (square)
 * @param outputPath  where to write the PNG
 * @param opts.maskable  if true, draws a full-bleed background (no transparent
 *                       rounded corners) and shrinks the book glyph into the
 *                       ~80% "safe zone" so Android's adaptive-icon mask
 *                       (circle/squircle/rounded-square) never clips the artwork.
 */
function generatePwaIcon(size, outputPath, opts = {}) {
  const { maskable = false } = opts;
  const png = new PNG({ width: size, height: size });

  // Violet gradient background: #7c3aed -> #4c1d95
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;

      if (!maskable) {
        // Rounded corner masking (radius = size * 0.22) — only for the
        // standalone "any" purpose icon; maskable must stay full-bleed.
        const r = size * 0.22;
        let inCorner = false;
        if (x < r && y < r && (x - r) ** 2 + (y - r) ** 2 > r ** 2) inCorner = true;
        if (x > size - r && y < r && (x - (size - r)) ** 2 + (y - r) ** 2 > r ** 2) inCorner = true;
        if (x < r && y > size - r && (x - r) ** 2 + (y - (size - r)) ** 2 > r ** 2) inCorner = true;
        if (x > size - r && y > size - r && (x - (size - r)) ** 2 + (y - (size - r)) ** 2 > r ** 2) inCorner = true;

        if (inCorner) {
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 0;
          continue;
        }
      }

      // Vertical violet gradient
      const ratio = y / size;
      const red = Math.round(124 - ratio * 47);   // 124 -> 77
      const green = Math.round(58 - ratio * 29);  // 58  -> 29
      const blue = Math.round(237 - ratio * 90);  // 237 -> 147

      // Center book glyph — shrunk to fit inside the maskable safe zone.
      const glyphScale = maskable ? 0.68 : 1;
      const cx = size / 2;
      const cy = size / 2;
      const bw = size * 0.45 * glyphScale;
      const bh = size * 0.52 * glyphScale;

      const isBookArea = Math.abs(x - cx) < bw / 2 && Math.abs(y - cy) < bh / 2;
      const isBookSpine = Math.abs(x - cx) < size * 0.035 * glyphScale && Math.abs(y - cy) < bh / 2;

      if (isBookArea) {
        if (isBookSpine) {
          // Spine / divider
          png.data[idx] = 224;
          png.data[idx + 1] = 231;
          png.data[idx + 2] = 255;
          png.data[idx + 3] = 255;
        } else {
          // Book pages — white
          png.data[idx] = 255;
          png.data[idx + 1] = 255;
          png.data[idx + 2] = 255;
          png.data[idx + 3] = 255;
        }
      } else {
        png.data[idx] = red;
        png.data[idx + 1] = green;
        png.data[idx + 2] = blue;
        png.data[idx + 3] = 255;
      }
    }
  }

  const buffer = PNG.sync.write(png);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated ${outputPath} (${size}x${size}${maskable ? ', maskable' : ''})`);
}

const publicDir = path.join(__dirname, '..', 'public');
generatePwaIcon(192, path.join(publicDir, 'icon-192.png'));
generatePwaIcon(512, path.join(publicDir, 'icon-512.png'));
generatePwaIcon(192, path.join(publicDir, 'icon-192-maskable.png'), { maskable: true });
generatePwaIcon(512, path.join(publicDir, 'icon-512-maskable.png'), { maskable: true });
