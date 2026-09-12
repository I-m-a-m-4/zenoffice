"use client";

import React, { useEffect, useState, useRef } from "react";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/firebase";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader, ChevronLeft } from "lucide-react";
import { AppConfig } from "@/lib/config";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { trackLaunchStage } from "@/lib/launch-telemetry";
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from "@/context/i18n-context";

// Titles and descriptions are keys resolved at render — the array is module-level
// and cannot reach `t()`. The word-highlight below still matches on English, so
// other locales draw the headline plain rather than part-italic.
const loginVideoSlides = [
  {
    video: 'https://res.cloudinary.com/dd1czj85j/video/upload/v1786053655/zeneva/zeneva_welcome_signup_video_6.mp4',
    poster: '/signup-video-6-poster.jpg',
    titleKey: 'auth.loginSlide1Title',
    descKey: 'auth.loginSlide1Desc',
  },
  {
    video: 'https://res.cloudinary.com/dd1czj85j/video/upload/v1786053651/zeneva/zeneva_welcome_signup_video_5.mp4',
    poster: '/signup-video-5-poster.jpg',
    titleKey: 'auth.loginSlide2Title',
    descKey: 'auth.loginSlide2Desc',
  },
  {
    video: 'https://res.cloudinary.com/dd1czj85j/video/upload/v1786053621/zeneva/zeneva_welcome_signup_video_2.mp4',
    poster: '/signup-video-2-poster.jpg',
    titleKey: 'auth.loginSlide3Title',
    descKey: 'auth.loginSlide3Desc',
  }
];

export default function LoginPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const handleVideoEnded = (index: number) => {
    if (index === currentSlide) {
      setCurrentSlide((prev) => (prev + 1) % loginVideoSlides.length);
    }
  };

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Handle getRedirectResult when the page mounts after a Google redirect login
  useEffect(() => {
    if (!auth) return;
    
    let isMounted = true;
    
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result || !isMounted) return;
        // User is successfully signed in. AuthLayout handles the redirection to POS page.
      })
      .catch((error: any) => {
        console.error("Redirect auth error:", error);
        const isCancellation =
          error?.code === 'auth/popup-closed-by-user' ||
          error?.code === 'auth/cancelled-popup-request' ||
          error?.code === 'auth/user-cancelled' ||
          error?.code === 'auth/redirect-cancelled-by-user';

        // Recorded even when it is a cancellation: on the desktop shell a
        // "cancelled" redirect is indistinguishable from a webview that could
        // never have completed one, and telling those apart is the point.
        void trackLaunchStage('login_failed', `redirect:${error?.code ?? 'unknown'}`);

        if (!isCancellation) {
          toast({
            variant: "destructive",
            title: t('auth.authFailedTitle'),
            description: error.message || t('auth.redirectSignInFailed'),
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [auth, toast, t]);

  const handleGoogleLogin = async () => {
    if (!auth) return;
    setIsGoogleLoading(true);
    void trackLaunchStage('login_attempted', 'google');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });


      try {
        await signInWithPopup(auth, provider);
        // AuthLayout handles the redirection once auth state changes
        void trackLaunchStage('login_succeeded', 'google-popup');
      } catch (popupError: any) {
        const isDesktop = typeof window !== 'undefined' && window.innerWidth > 768 && !/Mobi|Android/i.test(navigator.userAgent);
        
        if (popupError?.code === 'auth/internal-error') {
            // Firebase internal errors are usually transient. Wait briefly and retry once.
            await new Promise(resolve => setTimeout(resolve, 1200));
            await signInWithPopup(auth, provider);
            void trackLaunchStage('login_succeeded', 'google-popup');
            return;
        }

        if (
          popupError?.code === 'auth/operation-not-supported-in-this-environment' ||
          (popupError?.code === 'auth/popup-blocked' && !isDesktop) || 
          (!isDesktop && popupError?.code === 'auth/network-request-failed')
        ) {
          // The webview cannot host a popup, or mobile browser blocked it.
          // This branch navigates the whole shell away.
          void trackLaunchStage(
            'login_failed',
            `popup-fallback:${popupError?.code ?? 'unknown'}`,
          );
          await signInWithRedirect(auth, provider);
        } else {
          throw popupError;
        }
      }
    } catch (error: any) {
      const isCancellation =
        error?.code === 'auth/popup-closed-by-user' ||
        error?.code === 'auth/cancelled-popup-request' ||
        error?.code === 'auth/user-cancelled' ||
        error?.code === 'auth/redirect-cancelled-by-user';

      if (!isCancellation) {
          console.error("Google auth error:", error);
      }
        error?.code === 'auth/popup-closed-by-user' ||
        error?.code === 'auth/cancelled-popup-request' ||
        error?.code === 'auth/user-cancelled' ||
        error?.code === 'auth/redirect-cancelled-by-user';

      void trackLaunchStage('login_failed', `google:${error?.code ?? 'unknown'}`);

      if (!isCancellation) {
        const errorDesc = error?.code === 'auth/internal-error'
          ? t('auth.googleTemporaryIssue')
          : error?.code === 'auth/popup-blocked'
          ? t('auth.popupBlocked')
          : (error.message || t('auth.tryAgainShort'));
        toast({
          variant: "destructive",
          title: t('auth.googleAuthFailedTitle'),
          description: errorDesc,
        });
      }
      setIsGoogleLoading(false);
    }
  };

  useEffect(() => {
    loginVideoSlides.forEach((_, index) => {
      const video = videoRefs.current[index];
      if (!video) return;

      if (index === currentSlide) {
        video.currentTime = 0;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [currentSlide]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      toast({
        title: t('auth.serviceUnavailable'),
        variant: "destructive"
      });
      return;
    }
    setIsLoading(true);
    void trackLaunchStage('login_attempted', 'password');
    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        const user = userCredential.user;
        void trackLaunchStage('login_succeeded', 'password');
        const isSuperAdmin = user.email === 'belloimam431@gmail.com';
        
        // Check for MFA enrollment if Super Admin
        if (isSuperAdmin && user.providerData[0].providerId === 'password') {
          const enrolledFactors = (user as any).multiFactor?.enrolledFactors || [];
          if (enrolledFactors.length === 0) {
              console.warn("MFA Requirement: Super Admin must enroll in MFA.");
              // We'll handle redirection in the AuthLayout or here if preferred.
          }
        }
      })
      .catch((error) => {
        let description = t('auth.invalidCredentials');
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          description = t('auth.invalidCredentialsDetailed');
        }
        // The code, never the email or password. This endpoint is
        // unauthenticated, so nothing identifying may leave the device — and
        // `auth/invalid-api-key` versus `auth/invalid-credential` is the whole
        // difference between a broken build and a genuine wrong password, which
        // the toast above shows identically.
        void trackLaunchStage('login_failed', `password:${error?.code ?? 'unknown'}`);
        toast({
          variant: 'destructive',
          title: t('auth.loginFailedTitle'),
          description: description,
        });
        setIsLoading(false); // Only set loading to false on failure.
      });
  };

  return (
    <div className="w-full min-h-screen flex lg:grid lg:grid-cols-2">
      <div className="flex flex-col min-h-screen relative w-full px-4 sm:px-6 py-8">
        <div className="absolute top-8 left-4 sm:left-8 z-20">
          <Button variant="ghost" asChild>
            <Link href="/signup">
              {t('auth.createAccountLink')}
            </Link>
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center w-full py-12">
          <div className="mx-auto grid w-full max-w-[350px] gap-6">
            <div className="grid gap-2 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <img src={AppConfig.logoUrl} alt={t('auth.logoAlt')} className="h-16 w-auto" />
              </div>
              <h1 className="text-3xl font-bold">{t('auth.loginTitle')}</h1>
              <p className="text-balance text-muted-foreground">
                {t('auth.loginSubtitle')}
              </p>
            </div>
            <form onSubmit={handleLogin} className="grid gap-4">
              <div className="grid gap-2 focus-within-glow rounded-md">
                <Label htmlFor="email">{t('common.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2 focus-within-glow rounded-md">
                <div className="flex items-center">
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <Link
                    href="/forgot-password"
                    className="ml-auto inline-block text-sm underline"
                  >
                    {t('auth.forgotPasswordLink')}
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full button-glow" disabled={isLoading || isGoogleLoading}>
                {isLoading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                {t('auth.loginButton')}
              </Button>
            </form>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">{t('auth.orContinueWith')}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={handleGoogleLogin}
              disabled={isLoading || isGoogleLoading}
            >
              {isGoogleLoading ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Google</span>
                </>
              )}
            </Button>
            <div className="mt-4 text-center text-sm">
              {t('auth.noAccountPrompt')}{" "}
              <Link href="/signup" className="underline">
                {t('auth.signUpLink')}
              </Link>
            </div>
          </div>
        </div>
        <div className="w-full text-center mt-auto pb-4">
          <p className="text-[10px] text-muted-foreground/50 leading-relaxed max-w-[340px] mx-auto">
            {t('auth.legalSignIn')}{' '}
            <Link href="/legal/terms-of-service" className="text-primary underline hover:opacity-80" target="_blank">
              {t('footer.linkTerms')}
            </Link>{' '}
            {t('auth.legalAnd')}{' '}
            <Link href="/legal/privacy-policy" className="text-primary underline hover:opacity-80" target="_blank">
              {t('footer.linkPrivacyPolicy')}
            </Link>.
          </p>
        </div>
      </div>
      <div className="hidden bg-muted lg:block relative overflow-hidden bg-black">
        {/* Background Videos */}
        {loginVideoSlides.map((slide, index) => (
          <video
            key={index}
            ref={(el) => { videoRefs.current[index] = el; }}
            loop={false}
            muted
            playsInline
            autoPlay={index === currentSlide}
            preload="auto"
            poster={slide.poster}
            onEnded={() => handleVideoEnded(index)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
              index === currentSlide ? 'opacity-80 z-[0]' : 'opacity-0 z-[-1]'
            }`}
          >
            <source src={slide.video} type="video/mp4" />
          </video>
        ))}

        {/* Orangish filter overlay */}
        <div className="absolute inset-0 bg-orange-600/60 mix-blend-multiply z-[1] pointer-events-none" />

        {/* Dark overlay gradient for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-[2]" />

        <div className="absolute bottom-12 left-12 right-12 p-0 bg-transparent z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              <h2 className="text-white text-4xl font-bold font-headline leading-tight tracking-tight drop-shadow-lg">
                {t(loginVideoSlides[currentSlide].titleKey).split(" ").map((word, i) => (
                  <React.Fragment key={i}>
                    {word === "for" || word === "Galaxy" || word === "System" ? <span className="text-primary italic"> {word} </span> : word + " "}
                  </React.Fragment>
                ))}
              </h2>
              <p className="text-white/90 mt-4 text-xl font-light leading-relaxed drop-shadow-md max-w-[600px]">
                {t(loginVideoSlides[currentSlide].descKey)}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center gap-3">
            {loginVideoSlides.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 transition-all duration-500 rounded-full shadow-[0_0_10px_rgba(255,165,0,0.5)]",
                  currentSlide === i ? "w-12 bg-primary" : "w-2 bg-white/30"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
