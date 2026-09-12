const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];

if (!newVersion) {
  console.error('Please provide a version number (e.g., node scripts/update-version.js 0.5.2)');
  process.exit(1);
}

const packagePath = path.join(__dirname, '..', 'package.json');
const tauriConfPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');

// Update package.json
if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  pkg.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Updated package.json to ${newVersion}`);
}

// Update tauri.conf.json
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = newVersion;
  // The window title carries the version too; without this it silently drifts
  // (it still read v3.1.2 as of the 3.1.4 release).
  (tauriConf.app?.windows || []).forEach((w) => {
    if (typeof w.title === 'string') {
      w.title = w.title.replace(/v[\d.]+$/, `v${newVersion}`);
    }
  });
  const parts = newVersion.split('.').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    const major = parts[0];
    const minor = parts[1];
    const patch = parts[2];
    const versionCode = major * 1000000 + minor * 1000 + patch;
    if (!tauriConf.bundle) tauriConf.bundle = {};
    if (!tauriConf.bundle.android) tauriConf.bundle.android = {};
    tauriConf.bundle.android.versionCode = versionCode;
    console.log(`Updated android.versionCode to ${versionCode}`);
  }
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log(`Updated tauri.conf.json to ${newVersion}`);
}
// Update src-tauri/Cargo.toml
const cargoPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');
if (fs.existsSync(cargoPath)) {
  let cargo = fs.readFileSync(cargoPath, 'utf8');
  cargo = cargo.replace(/^version = ".*"/m, `version = "${newVersion}"`);
  fs.writeFileSync(cargoPath, cargo);
  console.log(`Updated Cargo.toml to ${newVersion}`);
}

// Update AppxManifest.xml
const appxManifestPath = 'C:\\Users\\Bello Imam\\Downloads\\ZenevaPack\\AppxManifest.xml';
if (fs.existsSync(appxManifestPath)) {
  let manifest = fs.readFileSync(appxManifestPath, 'utf8');
  manifest = manifest.replace(/Version="[\d\.]+"/, `Version="${newVersion}.0"`);
  fs.writeFileSync(appxManifestPath, manifest);
  console.log(`Updated AppxManifest.xml to ${newVersion}.0`);
}
