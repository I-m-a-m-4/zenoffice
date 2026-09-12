'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Root Error Caught:', error);

    if (error.name === 'ChunkLoadError' || error.message?.includes('ChunkLoadError')) {
      console.warn('ChunkLoadError detected in root boundary, reloading...');
      window.location.reload();
    }
  }, [error]);

  // Replaces the whole document, so no app providers or shared UI are available.
  return (
    <html lang="en">
      <head>
        <title>Something went wrong - Zeneva</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          backgroundColor: '#ffffff',
          color: '#18181b',
        }}
      >
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div style={{ maxWidth: '26rem', width: '100%', textAlign: 'center' }}>
            {/* Orange error icon ring */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '3.5rem',
                  height: '3.5rem',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(234, 88, 12, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ea580c"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" x2="12" y1="8" y2="12" />
                  <line x1="12" x2="12.01" y1="16" y2="16" />
                </svg>
              </div>
            </div>

            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                marginBottom: '0.5rem',
                color: '#18181b',
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                color: '#71717a',
                fontSize: '0.9375rem',
                lineHeight: '1.5',
                marginBottom: '1.75rem',
              }}
            >
              An unexpected error occurred while loading the application.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  borderRadius: '0.75rem',
                  border: 'none',
                  background: '#ea580c',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(234, 88, 12, 0.25)',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s ease',
                }}
                onMouseOver={(e) => (e.currentTarget.style.opacity = '0.92')}
                onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Refresh Page
              </button>

              <button
                onClick={() => reset()}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  borderRadius: '0.75rem',
                  border: '1px solid #e4e4e7',
                  background: '#f4f4f5',
                  color: '#27272a',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#e4e4e7')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#f4f4f5')}
              >
                Try again
              </button>
            </div>

            {error.digest && (
              <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '2rem' }}>
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
