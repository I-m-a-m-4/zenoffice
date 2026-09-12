import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findFile(dir, fileName) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      // Skip node_modules/target/.git for speed, and `build` because Gradle
      // writes a merged AndroidManifest.xml there. Patching that copy is
      // useless - it is regenerated from source on every build.
      if (file === 'node_modules' || file === 'target' || file === '.git' || file === 'build') continue;
      const found = findFile(fullPath, fileName);
      if (found) return found;
    } else if (file === fileName) {
      return fullPath;
    }
  }
  return null;
}

async function patchManifest() {
  // The canonical source manifest. Prefer it outright rather than trusting a
  // directory walk, which previously resolved to Gradle's merged copy under
  // app/build/intermediates/ and silently patched a throwaway file.
  const canonical = path.join(__dirname, '../src-tauri/gen/android/app/src/main/AndroidManifest.xml');
  if (fs.existsSync(canonical)) {
    processManifest(canonical);
    return;
  }

  // This script runs from tauri.conf.json's beforeBuildCommand, which fires for
  // every target - so a Windows or macOS build reaches here with no Android
  // project on disk. That is not an error: exit quietly and leave the build
  // alone. Only a *generated* Android project with an unreachable manifest is
  // worth failing over, because that is the case where a silent skip would ship
  // an APK with no RECORD_AUDIO and no permission dialog.
  const androidRoot = path.join(__dirname, '../src-tauri/gen/android');
  if (!fs.existsSync(androidRoot)) {
    console.log('No Android project at src-tauri/gen/android - nothing to patch.');
    return;
  }

  const searchRoot = path.join(__dirname, '../src-tauri');
  console.log(`Canonical manifest not found. Scanning recursively from: ${searchRoot}`);

  const manifestPath = findFile(searchRoot, 'AndroidManifest.xml');

  if (!manifestPath) {
    console.error('CRITICAL ERROR: Cannot locate AndroidManifest.xml. Direct integration aborted.');
    process.exit(1);
  }

  processManifest(manifestPath);
}

function processManifest(filePath) {
  console.log(`Found AndroidManifest.xml at: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Each entry is checked and injected independently so that adding a new
  // permission later is not skipped just because an earlier one is present.
  const entries = [
    { match: 'android.permission.CAMERA', tag: '<uses-permission android:name="android.permission.CAMERA" />' },
    { match: 'android.permission.RECORD_AUDIO', tag: '<uses-permission android:name="android.permission.RECORD_AUDIO" />' },
    { match: 'android.permission.MODIFY_AUDIO_SETTINGS', tag: '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />' },
    { match: 'android.permission.POST_NOTIFICATIONS', tag: '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />' },
    { match: 'android.permission.VIBRATE', tag: '<uses-permission android:name="android.permission.VIBRATE" />' },
    { match: 'android.hardware.camera"', tag: '<uses-feature android:name="android.hardware.camera" android:required="false" />' },
    { match: 'android.hardware.camera.autofocus', tag: '<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />' },
    { match: 'android.hardware.microphone', tag: '<uses-feature android:name="android.hardware.microphone" android:required="false" />' },
  ];

  const missing = entries.filter((e) => !content.includes(e.match));

  // Cleartext traffic is managed via gradle placeholders (${usesCleartextTraffic})
  // so we do not inject static android:usesCleartextTraffic attributes directly into <application>

  if (missing.length > 0 && content.includes('<application')) {
    const block = `
    <!-- Zeneva System-level Hardware Integrations -->
${missing.map((e) => `    ${e.tag}`).join('\n')}
`;
    content = content.replace('<application', `${block}\n    <application`);
  }

  // Inject host domain intent filter so Android Credential Manager associates zeneva.space with the app
  if (!content.includes('android:host="zeneva.space"') && content.includes('</activity>')) {
    const domainFilter = `
        <intent-filter android:autoVerify="true">
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="https" android:host="zeneva.space" />
        </intent-filter>
    `;
    content = content.replace('</activity>', `${domainFilter}\n    </activity>`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`SUCCESS: Patched AndroidManifest.xml with hardware entries and zeneva.space domain binding.`);
}

patchManifest().catch(console.error);
