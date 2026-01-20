/**
 * Convert source icon to Chrome extension sizes
 * @author haiping.yu@zoom.us
 * 
 * Usage:
 *   1. Save your icon as: public/icons/icon-source.png
 *   2. Run: node scripts/convert-icon.cjs
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available, if not provide instructions
try {
  const sharp = require('sharp');
  
  const ICON_SIZES = [16, 32, 48, 128];
  const SOURCE_PATH = path.join(__dirname, '../public/icons/icon-source.png');
  const OUTPUT_DIR = path.join(__dirname, '../public/icons');

  async function convertIcons() {
    // Check if source exists
    if (!fs.existsSync(SOURCE_PATH)) {
      console.error('Error: Source icon not found!');
      console.log('Please save your icon as: public/icons/icon-source.png');
      process.exit(1);
    }

    console.log('Converting icon to Chrome extension sizes...\n');

    for (const size of ICON_SIZES) {
      const outputPath = path.join(OUTPUT_DIR, `icon${size}.png`);
      
      await sharp(SOURCE_PATH)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Generated icon${size}.png (${size}x${size})`);
    }

    console.log('\n✅ All icons generated successfully!');
  }

  convertIcons().catch(console.error);

} catch (e) {
  console.log('Sharp not installed. Installing...\n');
  console.log('Run: pnpm add -D sharp');
  console.log('Then run this script again.\n');
  
  // Alternative: use canvas if available
  console.log('Or manually resize your icon to these sizes:');
  console.log('  - icon16.png  (16x16)');
  console.log('  - icon32.png  (32x32)');
  console.log('  - icon48.png  (48x48)');
  console.log('  - icon128.png (128x128)');
}

