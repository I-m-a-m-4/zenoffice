'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Pause, Play } from 'lucide-react';
import Image from 'next/image';
import { AppConfig } from '@/lib/config';
import { useI18n } from '@/context/i18n-context';

// `slides` is module-level, so a headline cannot be JSX with a <br /> any more —
// it has to be a key the render resolves. The line break lives inside the
// translated value as `\n` and is drawn by `whitespace-pre-line`, which lets each
// locale put the break where its own headline reads best.
const slides = [
  {
    video: 'https://res.cloudinary.com/dd1czj85j/video/upload/v1786053655/zeneva/zeneva_welcome_signup_video_6.mp4',
    poster: '/signup-video-6-poster.jpg',
    headlineKey: 'auth.welcomeSlide1',
  },
  {
    video: 'https://res.cloudinary.com/dd1czj85j/video/upload/v1786053651/zeneva/zeneva_welcome_signup_video_5.mp4',
    poster: '/signup-video-5-poster.jpg',
    headlineKey: 'auth.welcomeSlide2',
  },
  {
    video: 'https://res.cloudinary.com/dd1czj85j/video/upload/v1786053621/zeneva/zeneva_welcome_signup_video_2.mp4',
    poster: '/signup-video-2-poster.jpg',
    headlineKey: 'auth.welcomeSlide3',
  },
  {
    video: 'https://res.cloudinary.com/dd1czj85j/video/upload/v1786053615/zeneva/zeneva_welcome_signup_video_1.mp4',
    poster: '/signup-video-1-poster.jpg',
    headlineKey: 'auth.welcomeSlide4',
  },
];

export default function WelcomePage() {
  const { t } = useI18n();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // When the current video ends, advance to the next one
  const handleEnded = (index: number) => {
    if (index === currentIndex) {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }
  };

  // Force the mobile browser status bar / address bar chrome to black so it
  // blends with the dark video — theme-color meta in <Head> doesn't reach the
  // App Router shell, so we set it imperatively on mount and restore on unmount.
  //
  // This covers the browser and the PWA only. **The Tauri Android/iOS shells ignore
  // `theme-color` entirely** — a WebView is not Chrome — so it is not what darkens
  // the top band there. That band is web content: the desktop title-bar spacer in
  // `components/desktop/TauriWrapper.tsx`, which the mobile shells also render
  // because `__TAURI_INTERNALS__` is defined on them. `/welcome` is in that file's
  // `DARK_TOP_INSET_ROUTES`, which is what actually makes it dark. Changing the
  // colour here will not move it.
  useEffect(() => {
    const existing = document.querySelector('meta[name="theme-color"]');
    const prev = existing?.getAttribute('content') ?? null;
    if (existing) {
      existing.setAttribute('content', '#000000');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#000000';
      document.head.appendChild(meta);
    }
    // Also paint the html/body black so overscroll bounce areas are dark
    document.documentElement.style.backgroundColor = '#000000';
    document.body.style.backgroundColor = '#000000';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      const el = document.querySelector('meta[name="theme-color"]');
      if (el) el.setAttribute('content', prev ?? '#ffffff');
      document.documentElement.style.backgroundColor = '';
      document.body.style.backgroundColor = '';
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);

  // When currentIndex changes, manage play state
  useEffect(() => {
    slides.forEach((_, index) => {
      const video = videoRefs.current[index];
      if (!video) return;

      if (index === currentIndex) {
        // Seek to start and play
        video.currentTime = 0;
        if (isPlaying) video.play().catch(() => {});
      } else {
        // Pause immediately without seeking — keeps the first frame buffered
        // so the crossfade has a visible frame to transition into
        video.pause();
      }
    });
  }, [currentIndex, isPlaying]);

  const togglePlay = () => {
    const currentVideo = videoRefs.current[currentIndex];
    if (currentVideo) {
      if (isPlaying) {
        currentVideo.pause();
      } else {
        currentVideo.play().catch(() => {});
      }
      setIsPlaying(!isPlaying);
    }
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        html, body {
          overflow: hidden !important;
          background-color: #000000 !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }
        ::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      `}} />
      <div className="relative h-[100dvh] w-full overflow-hidden bg-black font-sans selection:bg-white/20 overscroll-none">
      {/* Background Videos */}
      {slides.map((slide, index) => (
        <video
          key={index}
          ref={(el) => { videoRefs.current[index] = el; }}
          loop={false}
          muted
          playsInline
          preload="auto"
          poster={slide.poster}
          onEnded={() => handleEnded(index)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
            index === currentIndex ? 'opacity-80 z-[0]' : 'opacity-0 z-[-1]'
          }`}
        >
          <source src={slide.video} type="video/mp4" />
        </video>
      ))}

      {/* Orangish filter overlay */}
      <div className="absolute inset-0 bg-orange-600/60 mix-blend-multiply z-[1] pointer-events-none" />

      {/* Dark overlay gradient for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

      {/*
        Foreground content.

        One flex column spanning the visible height, rather than two separately
        positioned layers. Everything is sized with clamp(min, preferred, max)
        keyed off vw/vh, so on a 360x640 Android the type, logo and buttons
        shrink to fit instead of pushing the headline off the top of the screen,
        and on a tablet they cap out at the original design sizes. The column
        never scrolls: the flexible spacer absorbs whatever room is left over.
      */}
      <div className="relative z-10 flex h-full flex-col px-[clamp(1rem,5vw,1.75rem)] pt-[clamp(0.75rem,2.5vh,1.5rem)] pb-[max(clamp(2.5rem,7vh,5.5rem),env(safe-area-inset-bottom,2.5rem))]"
           style={{ paddingBottom: 'max(clamp(2.5rem, 7vh, 5.5rem), calc(env(safe-area-inset-bottom, 0px) + 3.75rem))' }}>

        {/* Top Bar (Logo & Controls) */}
        <div className="flex flex-none items-start justify-between">
          <Image
            src={AppConfig.logoUrl}
            alt={t('auth.logoAlt')}
            width={96}
            height={96}
            priority
            className="h-[clamp(3rem,11vh,6rem)] w-[clamp(3rem,11vh,6rem)] object-contain drop-shadow-md"
          />

          <button
            onClick={togglePlay}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white transition-all hover:bg-black/60 focus:outline-none"
            aria-label={isPlaying ? t('auth.pauseVideo') : t('auth.playVideo')}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" fill="currentColor" stroke="currentColor" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" fill="currentColor" stroke="currentColor" />
            )}
          </button>
        </div>

        {/* Takes up the slack so the block below sits at the bottom. min-h-0
            lets it collapse to nothing on short screens instead of forcing
            the page taller than the viewport. */}
        <div className="min-h-0 flex-1" />

        {/* Headline */}
        <div className="mb-[clamp(1rem,3.5vh,2rem)] grid max-w-2xl flex-none">
          {slides.map((slide, index) => (
            <h1
              key={index}
              className={`col-start-1 row-start-1 whitespace-pre-line text-[clamp(1.75rem,min(8vw,5.2vh),4.5rem)] leading-[1.05] tracking-[-0.04em] font-medium text-white drop-shadow-sm transition-opacity duration-1000 ease-in-out ${
                index === currentIndex ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
            >
              {t(slide.headlineKey)}
            </h1>
          ))}
        </div>

        {/* Slide Dots */}
        <div className="mb-[clamp(0.875rem,2.5vh,1.5rem)] flex flex-none items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              aria-label={t('auth.goToVideo', { number: i + 1 })}
              className={`rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? 'w-6 h-2 bg-white'
                  : 'w-2 h-2 bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex w-full flex-none flex-col gap-[clamp(0.5rem,1.4vh,0.75rem)] sm:max-w-md">
          <Link
            href="/signup"
            className="flex h-[clamp(2.875rem,6.5vh,3.5rem)] w-full items-center justify-center rounded-full bg-white text-[clamp(0.9375rem,3.8vw,1rem)] font-medium text-black transition-transform active:scale-[0.98] hover:bg-gray-100"
          >
            {t('auth.createAccountButton')}
          </Link>
          <Link
            href="/login"
            className="flex h-[clamp(2.875rem,6.5vh,3.5rem)] w-full items-center justify-center rounded-full bg-orange-950/90 text-[clamp(0.9375rem,3.8vw,1rem)] font-medium text-white backdrop-blur-sm transition-transform active:scale-[0.98] hover:bg-orange-900"
          >
            {t('auth.signInButton')}
          </Link>
        </div>
      </div>
      </div>
    </>
  );
}
