import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const password = crypto.randomBytes(12).toString('hex');
const alias = 'upload';
const dname = "CN=Zeneva App, OU=Engineering, O=Zeneva, L=San Francisco, S=California, C=US";

const appDir = path.join(process.cwd(), 'src-tauri', 'gen', 'android', 'app');
const keystorePath = path.join(appDir, 'upload-keystore.jks');
const propertiesPath = path.join(appDir, 'key.properties');

if (fs.existsSync(keystorePath)) {
  fs.unlinkSync(keystorePath);
}

const keytoolCmd = `"C:\\Program Files\\Android\\Android Studio1\\jbr\\bin\\keytool.exe" -genkey -v -keystore "${keystorePath}" -alias ${alias} -keyalg RSA -keysize 2048 -validity 10000 -storepass ${password} -keypass ${password} -dname "${dname}"`;

try {
  execSync(keytoolCmd, { stdio: 'inherit' });
  console.log('Keystore generated successfully.');
  
  const propertiesContent = `storePassword=${password}\nkeyPassword=${password}\nkeyAlias=${alias}\nstoreFile=upload-keystore.jks\n`;
  
  fs.writeFileSync(propertiesPath, propertiesContent);
  console.log('key.properties created successfully.');
  
  console.log(`\n\n--- PLEASE BACKUP THESE CREDENTIALS ---`);
  console.log(`Keystore Password: ${password}`);
  console.log(`Key Alias: ${alias}`);
  console.log(`-----------------------------------------\n`);
} catch (e) {
  console.error('Error generating keystore:', e);
}
