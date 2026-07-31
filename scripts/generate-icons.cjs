const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

function generatePwaIcon(size, outputPath) {
  const png = new PNG({ width: size, height: size });

  // Indigo gradient background: #4f46e5 to #3730a3
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      
      // Rounded corner masking (radius = size * 0.22)
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

      // Vertical Indigo Gradient
      const ratio = y / size;
      const red = Math.round(79 - ratio * 24);   // 79 -> 55
      const green = Math.round(70 - ratio * 22); // 70 -> 48
      const blue = Math.round(229 - ratio * 66); // 229 -> 163

      // Center Book Icon draw (simplified silhouette)
      const cx = size / 2;
      const cy = size / 2;
      const bw = size * 0.45;
      const bh = size * 0.52;

      const isBookArea = Math.abs(x - cx) < bw / 2 && Math.abs(y - cy) < bh / 2;
      const isBookSpine = Math.abs(x - cx) < size * 0.035 && Math.abs(y - cy) < bh / 2;

      if (isBookArea) {
        if (isBookSpine) {
          // Spine / Divider
          png.data[idx] = 224;
          png.data[idx + 1] = 231;
          png.data[idx + 2] = 255;
          png.data[idx + 3] = 255;
        } else {
          // Book Pages - White
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
  console.log(`Generated ${outputPath} (${size}x${size})`);
}

const publicDir = path.join(__dirname, '..', 'public');
generatePwaIcon(192, path.join(publicDir, 'icon-192.png'));
generatePwaIcon(512, path.join(publicDir, 'icon-512.png'));
