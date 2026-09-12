'use client'
 
import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import NProgress from 'nprogress'
 
export function NavigationEvents() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
 
  useEffect(() => {
    // Only call NProgress.done() if NProgress has been started.
    // This prevents errors if the component re-renders without a preceding NProgress.start().
    if (NProgress.isStarted()) {
        NProgress.done();
    }
  }, [pathname, searchParams])
 
  return null
}
