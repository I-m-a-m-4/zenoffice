# Android Production Keystore Setup for Tauri & CI

This workflow documents how to set up a production Android Keystore for a Tauri mobile app, securely back it up locally (and to Firestore if needed), and configure `build.gradle.kts` so that it doesn't break cloud CI environments (like GitHub Actions) that don't have access to the local keystore file.

## 1. Generate the Keystore Securely
Do not hardcode simple passwords. Instead, generate secure random passwords for both the store and the key, and create the keystore using `keytool`.

```javascript
// generate_keystore.mjs (Example Node script to automate this securely)
import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';

const password = crypto.randomBytes(12).toString('hex'); // Generate strong password
const alias = 'upload';
const dname = "CN=Zeneva App, OU=Engineering, O=Zeneva, L=San Francisco, S=California, C=US";

const keystorePath = "src-tauri/gen/android/app/upload-keystore.jks";
const propertiesPath = "src-tauri/gen/android/app/key.properties";

// Run keytool (Ensure keytool is in PATH or use absolute path to Android Studio jbr/bin/keytool)
const keytoolCmd = `keytool -genkey -v -keystore "${keystorePath}" -alias ${alias} -keyalg RSA -keysize 2048 -validity 10000 -storepass ${password} -keypass ${password} -dname "${dname}"`;

execSync(keytoolCmd, { stdio: 'inherit' });

// Create key.properties for Gradle
const propertiesContent = `storePassword=${password}\nkeyPassword=${password}\nkeyAlias=${alias}\nstoreFile=upload-keystore.jks\n`;
fs.writeFileSync(propertiesPath, propertiesContent);
```

## 2. Secure Local Backups & Git Ignore
1. Add `*.jks`, `key.properties`, and any local backup files to `src-tauri/gen/android/app/.gitignore` (or the root `.gitignore`) so they are **never** pushed to the repository.
2. Provide the passwords clearly to the user to back up in a password manager.
3. (Optional but recommended) Run a script to backup the keystore file (base64 encoded) and passwords into a secure cloud storage like Firestore, so the user never loses the keys.

## 3. Configure `build.gradle.kts` (CI Safe)
Modify `src-tauri/gen/android/app/build.gradle.kts` to load `key.properties` **conditionally**. If it's missing (e.g. running on GitHub Actions), Gradle should skip it and build an unsigned `.aab` or use a different CI signing mechanism.

```kotlin
// In build.gradle.kts
val keystorePropertiesFile = rootProject.file("app/key.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(java.io.FileInputStream(keystorePropertiesFile))
}

android {
    // ...
    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String?
            keyPassword = keystoreProperties["keyPassword"] as String?
            storeFile = keystoreProperties["storeFile"]?.let { file(it) }
            storePassword = keystoreProperties["storePassword"] as String?
        }
    }
    
    buildTypes {
        getByName("release") {
            // ...
            // ONLY apply signing config if the properties file actually exists!
            if (keystorePropertiesFile.exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
}
```

## 4. Building Locally vs CI
- **Local**: Running `npx tauri android build` locally will detect `key.properties` and produce a signed `.aab` ready for the Play Store.
- **CI/CD**: GitHub Actions will not find `key.properties` (since it's git-ignored). It will produce an unsigned `.aab` (or fall back to `zeneva.keystore` / `jarsigner` logic inside the workflow YAML). This prevents `os error 28` or missing file crashes during automated deployment pipelines!
