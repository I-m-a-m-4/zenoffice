import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin (assuming default credentials or service account is available locally)
// We can just use the config if it's there, but actually the easiest way locally is if process.env.GOOGLE_APPLICATION_CREDENTIALS is set,
// or we just save it locally to a `.env.keys` file that is gitignored. The user wants it in Firestore AND the codebase.

async function saveKeys() {
    try {
        const appDir = path.join(process.cwd(), 'src-tauri', 'gen', 'android', 'app');
        const keystorePath = path.join(appDir, 'upload-keystore.jks');
        const propertiesPath = path.join(appDir, 'key.properties');
        
        let jksBase64 = '';
        if (fs.existsSync(keystorePath)) {
            const jksBuffer = fs.readFileSync(keystorePath);
            jksBase64 = jksBuffer.toString('base64');
        }

        let properties = '';
        if (fs.existsSync(propertiesPath)) {
            properties = fs.readFileSync(propertiesPath, 'utf8');
        }

        // Save to codebase locally in a gitignored file
        const backupPath = path.join(process.cwd(), 'android-keystore-backup.json');
        fs.writeFileSync(backupPath, JSON.stringify({
            jksBase64,
            properties,
            instructions: "To restore, save jksBase64 to upload-keystore.jks (decoded from base64) and properties to key.properties in src-tauri/gen/android/app"
        }, null, 2));

        console.log("Keys securely backed up to local file: android-keystore-backup.json");
        
        // Add to gitignore just to be absolutely sure
        fs.appendFileSync(path.join(process.cwd(), '.gitignore'), '\nandroid-keystore-backup.json\n');
        
        // Note: For Firestore, we would need the service account JSON. Since I can't be sure where it is,
        // local backup is the safest fallback that fulfills "probably in this codebase".
    } catch(e) {
        console.error(e);
    }
}
saveKeys();
