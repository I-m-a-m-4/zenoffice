'use client';
import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader } from 'lucide-react';
import { useI18n } from '@/context/i18n-context';

function FullScreenLoader({ text, dark }: { text?: string; dark?: boolean }) {
  return (
    <div className={`flex h-screen w-full items-center justify-center flex-col gap-2 ${dark ? 'bg-black' : 'bg-background'}`}>
      <Loader className={`h-8 w-8 animate-spin ${dark ? 'text-white' : 'text-primary'}`} />
      {text && <p className={`text-sm ${dark ? 'text-white/60' : 'text-muted-foreground'}`}>{text}</p>}
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();

  useEffect(() => {
    // If the user is authenticated and is no longer loading, redirect to the dashboard.
    // This handles cases where a logged-in user tries to access /login or /signup.
    if (user && !isUserLoading) {
      // The signup page has its own redirect logic after profile creation, so we exclude it here
      // to avoid interrupting the signup flow.
      const isSignupPage = pathname === '/signup' || pathname.startsWith('/signup?');
      if (!isSignupPage) {
        router.replace('/sales/pos/select-products');
      }
    }

    // If there is no user and the auth check is complete, they should be on an auth page.
    // No action is needed here, as they are allowed to see the content (e.g., login form).

  }, [user, isUserLoading, router, pathname]);

  // While the initial authentication state is being determined, show a loader.
  // Exception: For the /welcome page, we want it to render immediately so the video starts playing
  // and the user doesn't see a flash of a white loading screen.
  if (isUserLoading && pathname !== '/welcome') {
    return <FullScreenLoader text={t('auth.authenticating')} />;
  }

  // For the welcome page while loading, show a black screen to match the dark video feel
  if (isUserLoading && pathname === '/welcome') {
    return <FullScreenLoader dark />;
  }

  // If a user is logged in, they are about to be redirected by the useEffect.
  // Showing a loader here provides a better UX than a flash of the login/signup page.
  // We exclude the signup page from this logic as it handles its own post-signup redirect.
  const isSignupPage = pathname === '/signup' || pathname.startsWith('/signup?');
  if (user && !isSignupPage) {
    return <FullScreenLoader text={t('auth.loadingWorkspace')} />;
  }

  // If no user is logged in and we are not loading, it's safe to render the auth pages.
  // For the welcome page: use bg-black + overflow-hidden so the video fills edge-to-edge
  // with no white scrollbar or background bleeding through on mobile.
  //
  // `h-screen` is 100vh, which on mobile Safari/Chrome is the viewport *without*
  // the browser chrome - taller than what you can actually see. Combined with
  // the page's own 100dvh that produced a page you could scroll a few pixels.
  // dvh matches the visible area, so the welcome screen fits exactly.
  const isWelcomePage = pathname === '/welcome';
  return (
    <div className={`w-full ${
      isWelcomePage ? 'h-[100dvh] overflow-hidden bg-black overscroll-none' : 'h-screen overflow-y-auto'
    }`}>
      {children}
    </div>
  );
}
