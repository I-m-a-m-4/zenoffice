import fs from 'fs';
import path from 'path';

const outDir = path.resolve(process.cwd(), 'out');
if (fs.existsSync(outDir)) {
  console.log('--- Cleaning up static export directory for Tauri ---');
  
  // Large files that should not be embedded inside the Tauri desktop/mobile binaries
  const filesToDelete = [
    'zeneva_2.7.7_x64_en-US.msi',
    'zeneva_video.mp4',
    'computer.png',
    'computer-P.png',
    'crm.png',
    'data-vis.jpg',
    'dynamic-data-visualization-3d.jpg',
    'unify.png',
    'zeneva.png',
    'zeneva-signup-2.png',
    'zeneva-signup-3.png',
    'zeneva-signup-4.png',
    'zeneva-signup-v3.png',
    'zeneva-signup.png',
    'zeneva_team_photo.png',
    'zeneva_desktop_mastery_showcase.png',
    'zeneva_mobile_scanning_showcase.png',
    'zeneva_hardware_protocol_showcase.png'
  ];

  filesToDelete.forEach(file => {
    const filePath = path.join(outDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`Excluding from app bundle: ${file}`);
      fs.unlinkSync(filePath);
    }
  });

  console.log('--- Cleanup complete ---');
} else {
  console.warn('Warning: out/ directory not found. Cleanup skipped.');
}
