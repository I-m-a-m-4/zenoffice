'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function LoginSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const token = searchParams.get('token');
    const redirect = searchParams.get('redirect') || '/dashboard';

    if (!token) {
      setError('Invalid or expired login link.');
      return;
    }

    const processLogin = async () => {
      try {
        await signInWithCustomToken(auth, token);
        toast({ variant: 'success', title: 'Authenticated Successfully', description: 'Redirecting you...' });
        router.replace(redirect);
      } catch (err: any) {
        console.error('Magic link sign-in error:', err);
        setError(err.message || 'Could not verify your login link. It may have expired.');
      }
    };

    processLogin();
  }, [searchParams, router, toast]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardHeader>
            <CardTitle className="text-destructive font-bold text-2xl">Authentication Failed</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => router.replace('/login')}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              Go to Login Page
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest animate-pulse">
          Logging you in securely...
        </p>
      </div>
    </div>
  );
}

export default function LoginSessionPage() {
  return (
    <React.Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </div>
    }>
      <LoginSessionContent />
    </React.Suspense>
  );
}
