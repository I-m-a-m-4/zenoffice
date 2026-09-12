# Compress and Upload Videos to Cloudinary

This workflow documents how to compress large background videos and upload them to Cloudinary for optimized streaming, replacing local large MP4 files.

## Steps

1. **Locate the Videos**
   Identify the large `.mp4` files in the `public/` directory (e.g., `public/inventory-bg.mp4`).

2. **Upload to Cloudinary**
   Create a Node script (e.g. `upload_to_cloudinary.mjs`) to upload the videos using the Cloudinary SDK.
   
   ```javascript
   import { v2 as cloudinary } from 'cloudinary';
   
   cloudinary.config({ 
       cloud_name: 'YOUR_CLOUD_NAME', 
       api_key: 'YOUR_API_KEY', 
       api_secret: 'YOUR_API_SECRET'
   });
   
   cloudinary.uploader.upload("public/video.mp4", { resource_type: "video" })
     .then(result => console.log(result.secure_url));
   ```

3. **Update the Application Code**
   Replace the local video `src` paths in the React components (e.g., `src/app/(auth)/welcome/page.tsx`) with the generated Cloudinary `secure_url`.
   *Note: Cloudinary automatically optimizes and compresses videos for the user's device when requested.*

4. **Verify and Deploy**
   Ensure the videos load correctly in the browser, commit the changes to Git, and push to trigger a redeployment. Optionally, remove the old `.mp4` files from the repository to save space if they are no longer needed.
