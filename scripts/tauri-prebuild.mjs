import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
        results = results.concat(walk(file));
    } else if (file.endsWith('route.ts') || file.endsWith('route.js')) { 
        results.push(file);
    }
  });
  return results;
}

const apiFiles = walk(path.join(process.cwd(), 'src/app/api'));

const specialFiles = ['src/app/robots.ts', 'src/app/sitemap.ts'];
specialFiles.forEach(file => {
  if (fs.existsSync(path.join(process.cwd(), file))) {
    apiFiles.push(path.join(process.cwd(), file));
  }
});

const renamed = [];
apiFiles.forEach(file => {
  fs.renameSync(file, file + '.bak');
  renamed.push(file);
});

console.log('Successfully renamed API routes to .bak to bypass Next.js static export errors completely.');

import { execSync } from 'child_process';
console.log('Starting Next.js static export build...');
process.env.IS_TAURI = 'true';

// The rename above must be undone even when the build throws. Without this, a
// failed build left every route as a .bak with no route.ts beside it — commit
// that tree and ~20 endpoints ship as 404s, which is how the Paystack webhooks
// and /api/upload went missing in production.
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('Next.js build finished.');
} catch (err) {
  console.error('Next.js build failed — restoring API routes before exiting.');
  renamed.forEach(file => {
    const bak = file + '.bak';
    if (fs.existsSync(bak) && !fs.existsSync(file)) fs.renameSync(bak, file);
  });
  throw err;
}
