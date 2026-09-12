import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function safeToDate(timestamp: any): Date {
  if (!timestamp) return new Date(0);
  
  let date: Date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (timestamp && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp && typeof timestamp === 'object' && timestamp.seconds !== undefined) {
    date = new Date(timestamp.seconds * 1000);
  } else if (typeof timestamp === 'number' || typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    date = new Date(timestamp);
  }

  return isNaN(date.getTime()) ? new Date(0) : date;
}

export async function getCountryFromIP(): Promise<string> {
  // Check session storage cache first
  try {
    const cached = sessionStorage.getItem('zeneva_ip_country');
    if (cached) return cached;
  } catch (e) {
    // Ignore storage errors
  }

  let country = 'Unknown';

  // Ordered by reliability. freeipapi.com was first here but now answers with a
  // 302 and no Access-Control-Allow-Origin, so every call failed CORS and logged
  // a console error the try/catch cannot suppress - the browser logs a blocked
  // request regardless of whether the promise is handled.
  const providers: Array<{ url: string; read: (data: any) => string | undefined }> = [
    { url: 'https://ipwho.is/', read: (d) => (d?.success ? d.country : undefined) },
    { url: 'https://ipapi.co/json/', read: (d) => d?.country_name },
    { url: 'https://api.db-ip.com/v2/free/self', read: (d) => d?.countryName },
    { url: 'https://api.country.is/', read: (d) => d?.country },
  ];

  for (const provider of providers) {
    if (country !== 'Unknown') break;
    try {
      const res = await fetch(provider.url);
      if (!res.ok) continue;
      const value = provider.read(await res.json());
      if (value) country = value;
    } catch {
      // Provider unreachable or blocked - fall through to the next one.
    }
  }

  // Cache result if valid
  if (country !== 'Unknown') {
    try {
      sessionStorage.setItem('zeneva_ip_country', country);
    } catch (e) {
      // Ignore storage errors
    }
  }

  return country;
}
