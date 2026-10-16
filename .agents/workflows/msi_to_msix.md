---
description: Extract new files from a ZenOffice MSI installer and package them into an MSIX using MSIX Hero
---

Whenever a new MSI installer for ZenOffice (e.g., `ZenOffice_0.0.8_x64_en-US.msi`) is built and downloaded, follow this automated sequence to package it into an MSIX file:

1. **Locate the MSI File**:
   Find the latest MSI file matching `ZenOffice_*_x64_en-US.msi` in `C:\Users\Bello Imam\Downloads`.
   Extract the version number from the file name (e.g., `0.0.8` from `ZenOffice_0.0.8_x64_en-US.msi`).

2. **Extract the MSI (Quiet Mode)**:
   Extract the compiled binaries (like `app.exe`) to a temporary folder (`ZenOfficeExtract`) without opening any installation wizards:
   ```powershell
   Start-Process msiexec.exe -ArgumentList '/a "C:\Users\Bello Imam\Downloads\ZenOffice_VERSION_x64_en-US.msi" /qn TARGETDIR="C:\Users\Bello Imam\Downloads\ZenOfficeExtract"' -NoNewWindow -Wait
   ```
   *(Replace `VERSION` with the version found in step 1, e.g., `0.0.8`)*

3. **Update the MSIX Packing Folder**:
   Copy the newly extracted `app.exe` into the packaging directory, replacing the old build:
   ```powershell
   Copy-Item -Path "C:\Users\Bello Imam\Downloads\ZenOfficeExtract\PFiles\ZenOffice\app.exe" -Destination "C:\Users\Bello Imam\Downloads\ZenOfficePack\app.exe" -Force
   ```

4. **Clean Up Temporary Extraction Files**:
   Remove the temporary folder created in step 2:
   ```powershell
   Remove-Item -Path "C:\Users\Bello Imam\Downloads\ZenOfficeExtract" -Recurse -Force
   ```

5. **Update Version in Manifest (Optional)**:
   If the version has changed, update the version attribute in the `<Identity>` element within `C:\Users\Bello Imam\Downloads\ZenOfficePack\AppxManifest.xml` (e.g. `Version="0.0.8.0"`).

6. **Pack the Folder to MSIX**:
   Run MSIX Hero CLI to compile the package:
   ```powershell
   MSIXHeroCLI.exe pack -d "C:\Users\Bello Imam\Downloads\ZenOfficePack" -p "C:\Users\Bello Imam\Downloads\ZenOffice_VERSION.msix"
   ```
   *(Replace `VERSION` with the current version, e.g., `0.0.8`)*

7. **Done — do NOT sign for Store submission**:
   Partner Center signs the package with the Store identity
   (`CN=FB9C471D-AB12-4486-AC75-1AA3579E4073`) during certification. Shipped
   packages are unsigned locally — verify with:
   ```powershell
   Get-AuthenticodeSignature "C:\Users\Bello Imam\Downloads\ZenOffice_VERSION.msix" | Select-Object Status
   ```
   Upload the `.msix` straight to Partner Center.

   Only needed for **sideloading** (installing without the Store), which
   requires a certificate that is not present on this machine:
   ```powershell
   MSIXHeroCLI.exe sign -f "path\to\cert.pfx" -p "PASSWORD" "C:\...\ZenevaPack_VERSION.msix"
   ```

## Notes

- Quote the whole `-ArgumentList` as a **single string**, exactly as written in
  step 2. Passing a PowerShell array breaks on the spaces in `C:\Users\Bello
  Imam\...` and msiexec fails with error **1639** (invalid command line).
- Never name the variable `$args` — it is a reserved PowerShell automatic
  variable and `Start-Process` silently does nothing.
- `npm run version-up <version>` already updates `AppxManifest.xml`, so step 5
  is usually a no-op. Confirm the `<Identity Version="X.Y.Z.0">` matches before
  packing.

