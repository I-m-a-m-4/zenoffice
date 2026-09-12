import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

    if (!privateKey) {
      return NextResponse.json({ error: 'ImageKit private key is missing on the server.' }, { status: 500 });
    }

    // Convert the File into base64 format for ImageKit upload API
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64File = buffer.toString('base64');

    const imageKitFormData = new FormData();
    imageKitFormData.append('file', base64File);
    // Remove characters that might break the HTTP header or API values
    const safeFileName = (file.name || 'uploaded-file').replace(/[^a-zA-Z0-9.-]/g, '_');
    imageKitFormData.append('fileName', safeFileName);
    imageKitFormData.append('useUniqueFileName', 'true');
    imageKitFormData.append('folder', '/zeneva-uploads');

    const authHeader = 'Basic ' + Buffer.from(privateKey + ':').toString('base64');

    const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
      },
      body: imageKitFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ImageKit upload API error response:', errorText);
      return NextResponse.json({ error: 'Failed to upload image to ImageKit.' }, { status: response.status });
    }

    const resData = await response.json();
    return NextResponse.json({ success: true, url: resData.url });
  } catch (error: any) {
    console.error('Error in /api/upload route:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
