import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
    const url = req.nextUrl;
    const pathname = url.pathname;

    // Handle CORS for all API routes (to support Tauri desktop apps)
    //
    // The origin is reflected rather than allow-listed because the native
    // shells call the hosted API from origins that vary by platform
    // (tauri://localhost, https://tauri.localhost, capacitor://…).
    //
    // `Access-Control-Allow-Credentials` is deliberately NOT set. Every API
    // route here authenticates from the `Authorization` header, never an
    // ambient cookie, so credentials are unnecessary — and reflecting an
    // arbitrary origin *with* credentials would let any site a logged-in user
    // visits make authenticated cross-origin calls and read the responses.
    // src/app/api/admin/_guard.ts makes the same choice for the same reason.
    if (pathname.startsWith("/api/")) {
        const origin = req.headers.get("origin") || "*";

        // Handle preflight OPTIONS request
        if (req.method === "OPTIONS") {
            return new NextResponse(null, {
                status: 204,
                headers: {
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
                    "Vary": "Origin",
                },
            });
        }

        // Proceed to the API route, and append CORS headers to the response
        const res = NextResponse.next();
        res.headers.set("Access-Control-Allow-Origin", origin);
        res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
        res.headers.set("Vary", "Origin");
        return res;
    }

    // Get hostname (e.g. zeneva.space, shop.zeneva.space, localhost:3000)
    const hostname = req.headers.get("host") || "";

    // Remove port if present
    const domain = hostname.split(":")[0];

    // Define restricted subdomains that should NOT be rewritten to /store
    const restrictedSubdomains = ["www", "app", "localhost"];

    // Logic for zeneva.space subdomains
    if (domain.endsWith(".zeneva.space") && domain !== "zeneva.space") {
        const subdomain = domain.replace(".zeneva.space", "");

        // If it's a restricted subdomain (like www.zeneva.space), let it pass through (don't rewrite to store)
        if (restrictedSubdomains.includes(subdomain)) {
            return NextResponse.next();
        }

        // Rewrite to the store path
        // e.g. zeneva-shop.zeneva.space/cart -> zeneva.space/store/zeneva-shop/cart
        console.log(`[Middleware] Rewriting subdomain ${subdomain} to /store/${subdomain}`);
        url.pathname = `/store/${subdomain}${url.pathname}`;
        return NextResponse.rewrite(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all paths except for:
         * 1. /_next (Next.js internals)
         * 2. /_static (inside /public)
         * 3. all root files inside /public (e.g. /favicon.ico)
         */
        "/((?!_next/|_vercel/|_static/|[\\w-]+\\.\\w+).*)",
    ],
};
