
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const TAURI_CONFIG_PATH = 'src-tauri/tauri.conf.json';
const OUTPUT_FILE = 'latest.json';

async function main() {
  try {
    const config = JSON.parse(fs.readFileSync(TAURI_CONFIG_PATH, 'utf8'));
    
    // Prioritize environment variable for tag name (used in CI)
    const tagName = process.env.GITHUB_REF_NAME || `v${config.version || config.package?.version}`;
    const version = tagName.startsWith('v') ? tagName.substring(1) : tagName;

    console.log(`Generating ${OUTPUT_FILE} for version ${version}...`);

    const latestJson = {
      version: tagName,
      notes: `Zeneva Desktop v${version} release.`,
      pub_date: new Date().toISOString(),
      platforms: {}
    };

    // We assume the artifacts are in src-tauri/target/release/bundle/
    const bundleDir = 'src-tauri/target/release/bundle';
    console.log(`Searching for artifacts in ${path.resolve(bundleDir)}...`);
    
    // Windows Patterns (Tauri 2 often uses .nsis.zip or just .zip for updates)
    const windowsPatterns = [
        { bin: /\.nsis\.zip$/, sig: /\.nsis\.zip\.sig$/ },
        { bin: /\.zip$/, sig: /\.zip\.sig$/, exclude: /\.app\.tar\.gz$/ }
    ];

    let foundWindows = false;
    for (const pattern of windowsPatterns) {
        const binPath = findFile(bundleDir, pattern.bin, pattern.exclude);
        const sigPath = findFile(bundleDir, pattern.sig);
        
        if (binPath && sigPath) {
            console.log(`Found Windows Update artifact: ${binPath}`);
            const fileName = path.basename(binPath);
            const signature = fs.readFileSync(sigPath, 'utf8').trim();
            latestJson.platforms['windows-x86_64'] = {
                signature,
                url: `https://github.com/I-m-a-m-4/zeneva/releases/download/${tagName}/${fileName}`
            };
            foundWindows = true;
            break;
        }
    }

    if (!foundWindows) {
        console.warn('CRITICAL: No Windows update artifacts (.zip + .sig) found!');
    }

    // MacOS (Universal/Intel/ARM)
    const appPath = findFile(bundleDir, /\.app\.tar\.gz$/);
    const appSigPath = findFile(bundleDir, /\.app\.tar\.gz\.sig$/);

    if (appPath && appSigPath) {
        console.log('Found MacOS Update artifact:', appPath);
        const fileName = path.basename(appPath);
        const signature = fs.readFileSync(appSigPath, 'utf8').trim();
        latestJson.platforms['darwin-x86_64'] = {
            signature,
            url: `https://github.com/I-m-a-m-4/zeneva/releases/download/${tagName}/${fileName}`
        };
        latestJson.platforms['darwin-aarch64'] = {
            signature,
            url: `https://github.com/I-m-a-m-4/zeneva/releases/download/${tagName}/${fileName}`
        };
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(latestJson, null, 2));
    console.log(`Successfully generated ${OUTPUT_FILE} with platforms:`, Object.keys(latestJson.platforms));
    
    // Optional: Upload/Merge if GH_TOKEN is available
    if (process.env.GITHUB_TOKEN) {
        console.log(`Checking for existing ${OUTPUT_FILE} in release ${tagName}...`);
        try {
            execSync(`gh release download ${tagName} -p ${OUTPUT_FILE} --clobber`, { stdio: 'ignore' });
            const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
            console.log('Merging with existing manifest...');
            latestJson.platforms = { ...existing.platforms, ...latestJson.platforms };
        } catch (e) {
            console.log('No existing manifest found or failed to download. Creating new one.');
        }

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(latestJson, null, 2));
        console.log(`Uploading ${OUTPUT_FILE} to release ${tagName}...`);
        execSync(`gh release upload ${tagName} ${OUTPUT_FILE} --clobber`, { stdio: 'inherit' });
    }

  } catch (error) {
    console.error('Failed to generate latest.json:', error);
    process.exit(1);
  }
}

function findFile(dir, pattern, exclude) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir, { recursive: true });
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (pattern.test(file) && (!exclude || !exclude.test(file)) && fs.statSync(fullPath).isFile()) {
      return fullPath;
    }
  }
  return null;
}

main();
