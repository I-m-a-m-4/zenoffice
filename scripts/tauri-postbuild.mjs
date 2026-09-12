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
    } else if (file.endsWith('route.ts.bak') || file.endsWith('route.js.bak')) { 
        results.push(file);
    }
  });
  return results;
}

const apiFiles = walk(path.join(process.cwd(), 'src/app/api'));

const specialFiles = ['src/app/robots.ts.bak', 'src/app/sitemap.ts.bak'];
specialFiles.forEach(file => {
  if (fs.existsSync(path.join(process.cwd(), file))) {
    apiFiles.push(path.join(process.cwd(), file));
  }
});

apiFiles.forEach(file => {
  const target = file.replace(/\.bak$/, '');

  // If the real route already exists, it is the authoritative copy and the .bak
  // is stale — keep the route and drop the backup.
  //
  // This used to be an unconditional rename, which is how a set of stale .bak
  // files (committed by mistake, mid-build) silently clobbered live handlers and
  // took ~20 endpoints — including the Paystack webhooks and /api/upload — down
  // to 404 in production. A rename must never overwrite a file that a human put
  // back by hand.
  if (fs.existsSync(target)) {
    console.warn(`Skipping restore: ${path.relative(process.cwd(), target)} already exists; removing stale .bak.`);
    fs.rmSync(file, { force: true });
    return;
  }

  fs.renameSync(file, target);
});

console.log('Successfully restored API routes from .bak files.');
