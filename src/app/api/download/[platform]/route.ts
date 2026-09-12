import { NextRequest, NextResponse } from 'next/server';
import { AppConfig } from '@/lib/config';
import { adminFirestore } from '@/firebase/admin';
import crypto from 'crypto';

/**
 * GET /api/download/[platform] — resolve the latest release asset for a platform
 * and redirect to it, logging the click.
 *
 * This file was `route.ts.bak`, so every desktop download button on /download
 * (`/api/download/windows`, `macos-intel`, `macos-silicon`, `android`) answered
 * the HTML 404 page instead of redirecting. The Microsoft Store, Play Store and
 * GitHub links on that page kept working, which is why the breakage was easy to
 * miss. If direct downloads 404 again, check the filename first.
 *
 * It also carried a build-injected `export const dynamic = 'force-static'`,
 * which cannot be restored: the handler resolves the newest GitHub release per
 * request and sets a visitor cookie, neither of which survives prerendering.
 *
 * No CORS block here on purpose. This is reached by plain link navigation, not
 * fetch, so there is no preflight and no response body for a script to read.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  // Next 15 hands params in as a Promise. Destructuring it synchronously yields
  // undefined, which would send every download to the `default` 400 branch.
  const { platform } = await params;
  let version = AppConfig.version;
  let assets: Array<{ name: string; browser_download_url: string }> = [];

  try {
    const res = await fetch('https://api.github.com/repos/I-m-a-m-4/zeneva-releases/releases/latest?t=' + Date.now(), {
      headers: { 'User-Agent': 'zeneva' },
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      if (data.tag_name) {
        version = data.tag_name.replace(/^v/, '');
      }
      if (Array.isArray(data.assets)) {
        assets = data.assets;
      }
    }
  } catch (err) {
    console.error("Failed to fetch latest release from GitHub API:", err);
  }

  let downloadUrl = '';
  let responseCookieId = '';

  // Track download event with a unique, non-auth visitor cookie
  if (adminFirestore) {
    try {
      const visitorCookie = request.cookies.get('zeneva_visitor_id');
      let visitorId = visitorCookie ? visitorCookie.value : null;

      if (!visitorId) {
        visitorId = crypto.randomUUID();
        responseCookieId = visitorId;
      }

      const clickData = {
        lastClick: new Date(),
        userAgent: request.headers.get('user-agent') || 'unknown',
      };

      const docRef = adminFirestore.collection('download_clicks').doc(visitorId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        await docRef.set({
          ...clickData,
          firstClick: new Date(),
          platforms: [platform],
          clicks: 1,
        });
      } else {
        const existingPlatforms = docSnap.data()?.platforms || [];
        const updatedPlatforms = existingPlatforms.includes(platform) 
          ? existingPlatforms 
          : [...existingPlatforms, platform];
        
        await docRef.update({
          ...clickData,
          platforms: updatedPlatforms,
          clicks: (docSnap.data()?.clicks || 0) + 1,
        });
      }
    } catch (err) {
      console.error('Error logging download telemetry to Firestore:', err);
    }
  }

  // Helper to find asset by pattern
  const findAssetUrl = (endsWithStr: string, containsStr?: string) => {
    const matched = assets.find(asset => {
      const name = asset.name.toLowerCase();
      const matchEnds = name.endsWith(endsWithStr.toLowerCase());
      const matchContains = containsStr ? name.includes(containsStr.toLowerCase()) : true;
      return matchEnds && matchContains;
    });
    return matched ? matched.browser_download_url : '';
  };

  if (assets.length > 0) {
    switch (platform) {
      case 'windows':
        // Try MSI first, then setup EXE
        downloadUrl = findAssetUrl('.msi') || findAssetUrl('.exe');
        break;
      case 'macos-silicon':
        downloadUrl = findAssetUrl('aarch64.dmg') || findAssetUrl('.dmg', 'aarch64');
        break;
      case 'macos-intel':
        downloadUrl = findAssetUrl('x64.dmg') || findAssetUrl('.dmg', 'x64') || findAssetUrl('.dmg');
        break;
      case 'android':
        downloadUrl = findAssetUrl('signed.apk') || findAssetUrl('.apk');
        break;
    }
  }

  // Always fall back to the direct constructed download URL pattern instead of redirecting to the releases index
  if (!downloadUrl) {
    switch (platform) {
      case 'windows':
        // Point to the executable installer seen in the user screenshot
        downloadUrl = `https://github.com/I-m-a-m-4/zeneva-releases/releases/download/v${version}/zeneva_${version}_x64-setup.exe`;
        break;
      case 'macos-silicon':
        downloadUrl = `https://github.com/I-m-a-m-4/zeneva-releases/releases/download/v${version}/zeneva_${version}_aarch64.dmg`;
        break;
      case 'macos-intel':
        downloadUrl = `https://github.com/I-m-a-m-4/zeneva-releases/releases/download/v${version}/zeneva_${version}_x64.dmg`;
        break;
      case 'android':
        // Match the signed APK pattern perfectly
        downloadUrl = `https://github.com/I-m-a-m-4/zeneva-releases/releases/download/v${version}/zeneva-v${version}-SIGNED.apk`;
        break;
      default:
        return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }
  }

  const response = NextResponse.redirect(downloadUrl);
  if (responseCookieId) {
    response.cookies.set({
      name: 'zeneva_visitor_id',
      value: responseCookieId,
      maxAge: 60 * 60 * 24 * 365 * 2, // 2 years
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return response;
}
