import { NextResponse } from 'next/server';

async function fetchImageBuffer(url: string) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('Content-Type') || 'image/jpeg';
    return { buffer, contentType };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');
    const fallbackUrl = searchParams.get('fallback');

    if (!imageUrl) {
        return new NextResponse('URL parameter is required', { status: 400 });
    }

    try {
        // Attempt primary image download
        try {
            const { buffer, contentType } = await fetchImageBuffer(imageUrl);
            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=31536000, immutable',
                },
            });
        } catch (primaryErr) {
            console.warn(`[Image Proxy] Primary download failed for ${imageUrl}:`, primaryErr);
            
            // If primary failed and fallback exists, attempt fallback (e.g. CDN thumbnail)
            if (fallbackUrl && fallbackUrl !== imageUrl) {
                console.log(`[Image Proxy] Attempting fallback to ${fallbackUrl}`);
                const { buffer, contentType } = await fetchImageBuffer(fallbackUrl);
                return new NextResponse(buffer, {
                    headers: {
                        'Content-Type': contentType,
                        'Cache-Control': 'public, max-age=31536000, immutable',
                    },
                });
            }
            throw primaryErr;
        }
    } catch (error: any) {
        console.error('[Image Proxy] Error downloading image:', error);
        return new NextResponse(error.message || 'Internal server error', { status: 500 });
    }
}
