import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function main() {
  const svgPath = path.resolve('public/zenoffice-icon.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  console.log('Rendering public/zenoffice-icon.svg to 1024x1024 PNG...');
  await sharp(svgBuffer, { density: 300 })
    .resize(1024, 1024)
    .png()
    .toFile('public/icon-pwa.png');

  console.log('Rendering 180x180 apple-icon.png...');
  await sharp(svgBuffer, { density: 300 })
    .resize(180, 180)
    .png()
    .toFile('public/apple-icon.png');

  // Copy zenoffice-icon.svg to icon.svg so that both match the new document logo
  fs.copyFileSync('public/zenoffice-icon.svg', 'public/icon.svg');

  console.log('Icons generated in public/');
}

main().catch(console.error);
