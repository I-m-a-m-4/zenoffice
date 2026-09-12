'use client';

import { ArrowUp } from 'lucide-react';

export default function BackToTopButton() {
  const handleScrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <button onClick={handleScrollToTop} className="transition inline-flex items-center gap-1 hover:text-white">
      <ArrowUp className="w-4 h-4" /> Back to top
    </button>
  );
}
