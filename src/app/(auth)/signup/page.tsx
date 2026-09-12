"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { createUserProfileDocument, waitForUserProfile } from '@/firebase/users';
import { usePOS } from '@/context/pos-context';
import Link from 'next/link';
import { Eye, EyeOff, Loader, ChevronLeft, ChevronRight, Building, UserCheck, Play, Pause, Sparkles, ArrowRight, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AppConfig } from '@/lib/config';
import Image from 'next/image';
import { doc, getDoc } from 'firebase/firestore';

const makeSignupSchema = (t: (key: string) => string) => z.object({
  email: z.string()
    .email({ message: t('auth.valInvalidEmail') })
    .refine((email) => {
      const localPart = email.split('@')[0];
      return !localPart.includes('+');
    }, { message: t('auth.valNoAliases') })
    .refine((email) => {
      const domain = email.split('@')[1]?.toLowerCase();
      const disposableDomains = [
        'wshu.net', 'tempmail.com', 'mailinator.com', 'yopmail.com',
        'guerrillamail.com', 'dispostable.com', '10minutemail.com',
        'burnermail.io', 'trashmail.com', 'getairmail.com'
      ];
      return !disposableDomains.includes(domain);
    }, { message: t('auth.valNoDisposable') }),
  password: z.string().min(6, { message: t('auth.valPasswordMin') }),
});

type SignupFormValues = z.infer<ReturnType<typeof makeSignupSchema>>;

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { trackLaunchStage } from '@/lib/launch-telemetry';
import { useI18n } from '@/context/i18n-context';

// Titles and descriptions are keys resolved at render — the array is module-level
// and cannot reach `t()`. The word-highlight below still matches on English, so
// other locales draw the headline plain rather than part-italic.
const signupVideoSlides = [
  {
    video: 'https://res.cloudinary.com/dd1czj85j/video/upload/v1786053655/zeneva/zeneva_welcome_signup_video_6.mp4',
    poster: '/signup-video-6-poster.jpg',
    titleKey: 'auth.signupSlide1Title',
    descKey: 'auth.signupSlide1Desc',
  },
  {
    video: 'https://res.cloudinary.com/dd1czj85j/video/upload/v1786053651/zeneva/zeneva_welcome_signup_video_5.mp4',
    poster: '/signup-video-5-poster.jpg',
    titleKey: 'auth.signupSlide2Title',
    descKey: 'auth.signupSlide2Desc',
  },
  {
    video: 'https://res.cloudinary.com/dd1czj85j/video/upload/v1786053621/zeneva/zeneva_welcome_signup_video_2.mp4',
    poster: '/signup-video-2-poster.jpg',
    titleKey: 'auth.signupSlide3Title',
    descKey: 'auth.signupSlide3Desc',
  },
  {
    video: 'https://res.cloudinary.com/dd1czj85j/video/upload/v1786053615/zeneva/zeneva_welcome_signup_video_1.mp4',
    poster: '/signup-video-1-poster.jpg',
    titleKey: 'auth.signupSlide4Title',
    descKey: 'auth.signupSlide4Desc',
  }
];

function SignupPageContent() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const { triggerRefresh } = usePOS();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { t } = useI18n();
  const [currentSlide, setCurrentSlide] = useState(0);
  const videoRefs = React.useRef<(HTMLVideoElement | null)[]>([]);

  const [invitationDetails, setInvitationDetails] = useState<{ businessName: string, role: string } | null>(null);
  const [isLoadingInvitation, setIsLoadingInvitation] = useState(true);
  const invitationCode = searchParams.get('invitationCode');

  const [isPlaying, setIsPlaying] = useState(true);

  const handleVideoEnded = (index: number) => {
    if (index === currentSlide) {
      setCurrentSlide((prev) => (prev + 1) % signupVideoSlides.length);
    }
  };

  const toggleVideoPlayback = () => {
    const currentVideo = videoRefs.current[currentSlide];
    if (!currentVideo) return;
    if (isPlaying) {
      currentVideo.pause();
      setIsPlaying(false);
    } else {
      currentVideo.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    signupVideoSlides.forEach((_, index) => {
      const video = videoRefs.current[index];
      if (!video) return;

      if (index === currentSlide) {
        video.currentTime = 0;
        if (isPlaying) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      } else {
        video.pause();
      }
    });
  }, [currentSlide, isPlaying]);

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // `t` is referentially stable until the active catalog changes, so the resolver
  // is rebuilt exactly once per locale switch rather than on every render.
  const signupSchema = React.useMemo(() => makeSignupSchema(t), [t]);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (invitationCode && firestore) {
      const fetchInvitation = async () => {
        setIsLoadingInvitation(true);
        const invRef = doc(firestore, 'invitations', invitationCode);
        try {
          const invSnap = await getDoc(invRef);
          if (invSnap.exists()) {
            const invData = invSnap.data();
            const businessRef = doc(firestore, 'businessInstances', invData.businessId);
            const businessSnap = await getDoc(businessRef);
            if (businessSnap.exists()) {
              setInvitationDetails({
                businessName: businessSnap.data().name,
                role: invData.role.replace('_', ' '),
              });
              form.setValue('email', invData.email);
            } else {
              throw new Error("Associated business not found.");
            }
          } else {
            toast({ variant: "destructive", title: t('auth.invalidInvitationTitle'), description: t('auth.invalidInvitationBody') });
            router.replace('/signup');
          }
        } catch (error) {
          toast({ variant: "destructive", title: t('common.error'), description: t('auth.invitationLookupFailed') });
          router.replace('/signup');
        } finally {
          setIsLoadingInvitation(false);
        }
      };
      fetchInvitation();
    } else {
      setIsLoadingInvitation(false);
      const emailFromQuery = searchParams.get('email');
      if (emailFromQuery) {
        form.setValue('email', emailFromQuery);
      }
    }
  }, [invitationCode, firestore, router, form, toast, t]);

  // Handle getRedirectResult only for Tauri/WebView clients that used redirect
  useEffect(() => {
    if (!auth || !firestore) return;

    const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
    const isWebView = typeof navigator !== 'undefined' && /wv|Android.*Version\/[0-9.]+/i.test(navigator.userAgent);
    // Only wait for redirect result on native clients that can't use popups
    if (!isTauri && !isWebView) return;

    let isMounted = true;

    getRedirectResult(auth)
      .then(async (result) => {
        if (!result || !isMounted) return;
        const user = result.user;
        void trackLaunchStage('signup_succeeded', 'google-redirect');

        setIsGoogleLoading(true);
        try {
          const userDocRef = doc(firestore, `users/${user.uid}`);
          const userDocSnap = await getDoc(userDocRef);

          if (!userDocSnap.exists()) {
            await createUserProfileDocument(firestore, user, user.displayName || '', user.phoneNumber || '', invitationCode);
            await waitForUserProfile(firestore, user.uid);
            triggerRefresh();
            await new Promise(resolve => setTimeout(resolve, 1500));
            router.push(invitationCode ? '/sales/pos/select-products' : '/onboarding');
          } else {
            const profileData = userDocSnap.data();
            triggerRefresh();
            await new Promise(resolve => setTimeout(resolve, 1500));
            if (profileData.surveyCompleted === false) {
              router.push(invitationCode ? '/sales/pos/select-products' : '/onboarding');
            } else {
              router.push('/dashboard');
            }
          }
        } catch (profileErr: any) {
          console.error("Failed to create profile after redirect:", profileErr);
          // Signed in with no usable profile — the account exists and the app is
          // unusable, which is the single worst outcome in this funnel and was
          // previously only a toast.
          void trackLaunchStage(
            'signup_failed',
            `profile:${profileErr?.code ?? 'unknown'}`,
          );
          toast({
            variant: "destructive",
            title: t('auth.profileSetupFailedTitle'),
            description: t('auth.profileSetupFailedBody'),
          });
        } finally {
          if (isMounted) setIsGoogleLoading(false);
        }
      })
      .catch(() => {
        // Silently ignore — redirect result errors are expected when no redirect was in progress
      });

    return () => {
      isMounted = false;
    };
  }, [auth, firestore, router, invitationCode, triggerRefresh, toast, t]);

  const handleGoogleSignup = async () => {
    if (!auth || !firestore) return;
    setIsGoogleLoading(true);
    void trackLaunchStage('signup_started', 'google');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      // Always try popup first on web
      let result;
      try {
        result = await signInWithPopup(auth, provider);
      } catch (popupError: any) {
        const isDesktop = typeof window !== 'undefined' && window.innerWidth > 768 && !/Mobi|Android/i.test(navigator.userAgent);

        if (
          popupError?.code === 'auth/operation-not-supported-in-this-environment' ||
          (popupError?.code === 'auth/popup-blocked' && !isDesktop)
        ) {
          // Browser blocked the popup — fall back to redirect silently.
          // Recorded before the call, which navigates the whole shell away.
          void trackLaunchStage(
            'signup_failed',
            `popup-fallback:${popupError?.code ?? 'unknown'}`,
          );
          await signInWithRedirect(auth, provider);
          return;
        } else if (popupError?.code === 'auth/internal-error') {
          // Firebase internal errors are usually transient. Wait briefly and retry once.
          await new Promise(resolve => setTimeout(resolve, 1200));
          result = await signInWithPopup(auth, provider);
        } else {
          throw popupError;
        }
      }

      const user = result.user;
      void trackLaunchStage('signup_succeeded', 'google');

      // Create profile document if this is a brand-new Google sign-in
      const userDocRef = doc(firestore, `users/${user.uid}`);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await createUserProfileDocument(firestore, user, user.displayName || '', user.phoneNumber || '', invitationCode);
        await waitForUserProfile(firestore, user.uid);
        triggerRefresh();

        // Send welcome email asynchronously
        fetch('/api/emails/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            firstName: user.displayName?.split(' ')[0] || '',
            businessName: invitationDetails?.businessName || ''
          })
        }).catch(err => console.error('Failed to send welcome email:', err));

        // Brief pause so the POS context has time to pick up the new auth state
        await new Promise(resolve => setTimeout(resolve, 1200));
        router.push(invitationCode ? '/sales/pos/select-products' : '/onboarding');
      } else {
        const profileData = userDocSnap.data();
        triggerRefresh();
        await new Promise(resolve => setTimeout(resolve, 1200));
        if (profileData.surveyCompleted === false) {
          router.push(invitationCode ? '/sales/pos/select-products' : '/onboarding');
        } else {
          router.push('/dashboard');
        }
      }

    } catch (error: any) {
      const isCancellation =
        error?.code === 'auth/popup-closed-by-user' ||
        error?.code === 'auth/cancelled-popup-request' ||
        error?.code === 'auth/user-cancelled';

      if (!isCancellation) {
          console.error("Google auth error:", error);
      }

      void trackLaunchStage('signup_failed', `google:${error?.code ?? 'unknown'}`);

      if (isCancellation) {
        // User closed the popup — silently reset loading, no error toast
        setIsGoogleLoading(false);
        return;
      } else {
        toast({
          variant: "destructive",
          title: t('auth.googleSignInFailedTitle'),
          description:
            error?.code === 'auth/popup-blocked'
              ? t('auth.popupBlocked')
              : error?.code === 'auth/internal-error'
              ? t('auth.googleUnavailable')
              : (error.message || t('auth.tryAgainShort')),
        });
      }
      setIsGoogleLoading(false);
    }
  };


  const onSubmit = async (data: SignupFormValues) => {
    if (!auth || !firestore) return;
    setIsLoading(true);
    void trackLaunchStage('signup_started', 'password');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      // The account now exists, so the signup itself has succeeded even if the
      // profile write below does not. Recorded here rather than at the end so a
      // `signup_succeeded` *and* a `signup_failed: profile:*` on the same install
      // reads as what it is: an account that exists but cannot be used.
      void trackLaunchStage('signup_succeeded', 'password');
      await updateProfile(userCredential.user, { displayName: '' });

      // Pass invitation code to the creation function with empty strings for name and phone
      await createUserProfileDocument(firestore, userCredential.user, '', '', invitationCode);
      await waitForUserProfile(firestore, userCredential.user.uid);

      triggerRefresh();

      // Send welcome email asynchronously
      fetch('/api/emails/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userCredential.user.email,
          firstName: '',
          businessName: invitationDetails?.businessName || ''
        })
      }).catch(err => console.error('Failed to send welcome email:', err));

      await new Promise(resolve => setTimeout(resolve, 1500));
      router.push(invitationCode ? '/sales/pos/select-products' : '/onboarding');

    } catch (error: any) {
      let description = t('auth.tryAgainShort');
      if (error.code === 'auth/email-already-in-use') {
        description = t('auth.emailAlreadyRegistered');
      } else {
        description = error.message;
      }
      // Code only — never `error.message`, which on some Firebase errors embeds
      // the email that was typed, and this endpoint is unauthenticated.
      void trackLaunchStage('signup_failed', `password:${error?.code ?? 'unknown'}`);
      toast({ variant: "destructive", title: t('auth.signupFailedTitle'), description });
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex lg:grid lg:grid-cols-2">
      <div className="flex flex-col min-h-screen relative w-full px-4 sm:px-6 py-8">
        <div className="absolute top-8 left-4 sm:left-8 z-20">
          <Button variant="ghost" asChild>
            <Link href="/login">
              {t('auth.haveAccountPrompt')}
            </Link>
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center w-full py-12">
          <div className="mx-auto grid w-full max-w-[380px] gap-4 sm:gap-6">
            <div className="grid gap-2 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <img src={AppConfig.logoUrl} alt={t('auth.logoAlt')} className="h-12 sm:h-16 w-auto" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold">{t('auth.signupTitle')}</h1>
              <p className="text-balance text-sm sm:text-base text-muted-foreground">
                {t('auth.signupSubtitle')}
              </p>
              <div className="inline-flex items-center justify-center gap-1.5 py-1 px-3.5 mx-auto mt-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold shadow-xs">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>{t('auth.setupTimeBadge', { defaultValue: 'Takes 30 seconds to set up • Free forever plan' })}</span>
              </div>
            </div>

            {isLoadingInvitation ? (
              <div className="flex justify-center items-center h-24"><Loader className="animate-spin" /></div>
            ) : invitationDetails ? (
              <div className="p-4 rounded-lg border bg-primary/5 text-center">
                <div className="flex items-center justify-center gap-3">
                  <Building className="h-5 w-5 text-primary" />
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
                {/*
                  One key, not a split sentence. `translate()` returns a string and
                  cannot embed React nodes, and splitting on the two values to keep
                  the inline <strong>s would fix English word order — German puts the
                  verb particle last, Japanese puts both values before the verb. So
                  the two bolds and the CSS `capitalize` on the role are given up in
                  exchange for a sentence that reads correctly in all eleven locales.
                */}
                <p className="text-sm text-muted-foreground mt-2">
                  {t('auth.joiningBusiness', {
                    business: invitationDetails.businessName,
                    role: invitationDetails.role,
                  })}
                </p>
              </div>
            ) : null}

            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={handleGoogleSignup}
              disabled={isLoading || isLoadingInvitation || isGoogleLoading}
            >
              {isGoogleLoading ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
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
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              {t('auth.continueWithGoogle')}
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">{t('auth.orSignupWithEmail')}</span>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <Label>{t('common.email')}</Label>
                      <FormControl>
                        <Input type="email" placeholder={t('auth.emailPlaceholder')} {...field} disabled={!!invitationCode} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <Label>{t('auth.password')}</Label>
                      <FormControl>
                        <div className="relative">
                          <Input type={showPassword ? 'text' : 'password'} {...field} />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading || isLoadingInvitation || isGoogleLoading}>
                  {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : t('auth.createAccountSubmit')}
                </Button>
              </form>
            </Form>


            <div className="mt-4 text-center text-sm">
              {t('auth.haveAccountPrompt')}{" "}
              <Link href="/login" className="underline">
                {t('auth.loginLink')}
              </Link>
            </div>
          </div>
        </div>
        <div className="w-full text-center mt-auto pb-4">
          <p className="text-[10px] text-muted-foreground/50 leading-relaxed max-w-[340px] mx-auto">
            {t('auth.legalSignUp')}{' '}
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
        {signupVideoSlides.map((slide, index) => (
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20 z-[2]" />

        {/* Top Control Bar with Play/Pause & Arrow Buttons */}
        <div className="absolute top-8 right-8 z-20 flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={toggleVideoPlayback}
            className="bg-black/50 border-white/20 text-white backdrop-blur-md hover:bg-black/80 hover:text-white rounded-full text-xs font-semibold px-3 py-1.5 flex items-center gap-2 transition-all shadow-lg"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            {isPlaying ? t('auth.pauseVideoButton') : t('auth.playVideoButton')}
          </Button>

          <div className="flex items-center gap-1 bg-black/50 border border-white/20 backdrop-blur-md rounded-full p-1 shadow-lg">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => setCurrentSlide((prev) => (prev - 1 + signupVideoSlides.length) % signupVideoSlides.length)}
              className="h-7 w-7 text-white hover:bg-white/20 rounded-full"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-[11px] font-bold text-white/90 px-1 font-mono">
              0{currentSlide + 1} / 0{signupVideoSlides.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => setCurrentSlide((prev) => (prev + 1) % signupVideoSlides.length)}
              className="h-7 w-7 text-white hover:bg-white/20 rounded-full"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="absolute bottom-12 left-12 right-12 p-0 bg-transparent z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-bold uppercase tracking-wider mb-4 backdrop-blur-md shadow-md">
                <Sparkles className="h-3.5 w-3.5" />
                {t('auth.featuredExperience')}
              </div>

              <h2 className="text-white text-4xl font-bold font-headline leading-tight tracking-tight drop-shadow-lg">
                {t(signupVideoSlides[currentSlide].titleKey).split(" ").map((word, i) => (
                  <React.Fragment key={i}>
                    {word === "Operations" || word === "Ecosystem" || word === "Entry" || word === "Reach" || word === "Point" ? (
                      <span className="text-primary italic"> {word} </span>
                    ) : (
                      word + " "
                    )}
                  </React.Fragment>
                ))}
              </h2>
              <p className="text-white/90 mt-4 text-xl font-light leading-relaxed drop-shadow-md max-w-[600px]">
                {t(signupVideoSlides[currentSlide].descKey)}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Interactive Feature Video Selector Buttons */}
          <div className="mt-8 flex flex-wrap items-center gap-2.5">
            {signupVideoSlides.map((slide, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentSlide(i)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-300 backdrop-blur-md border flex items-center gap-2 cursor-pointer",
                  currentSlide === i
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_0_15px_rgba(255,165,0,0.5)] scale-105"
                    : "bg-black/40 text-white/70 border-white/10 hover:bg-black/60 hover:text-white"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", currentSlide === i ? "bg-primary-foreground" : "bg-primary")} />
                {t(slide.titleKey)}
              </button>
            ))}
          </div>

          {/* Progress Indicators */}
          <div className="mt-6 flex items-center gap-3">
            {signupVideoSlides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentSlide(i)}
                aria-label={t('auth.goToSlide', { number: i + 1 })}
                className={cn(
                  "h-1.5 transition-all duration-500 rounded-full cursor-pointer shadow-[0_0_10px_rgba(255,165,0,0.5)] border-none p-0",
                  currentSlide === i ? "w-12 bg-primary" : "w-2 bg-white/30 hover:bg-white/60"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <React.Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center flex-col gap-2 bg-background">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SignupPageContent />
    </React.Suspense>
  );
}
