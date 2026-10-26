'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle, 
    CardDescription 
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Loader, ShieldAlert, ShieldCheck } from 'lucide-react';

const SUPER_ADMIN_EMAIL = 'belloimam431@gmail.com';
const SUPER_ADMIN_UID = 'jzQgCHzaObeUbeYklTLtQQh03G53';

export default function AdminLoginPage() {
  const [email, setEmail] = useState(SUPER_ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGoogleProcessing, setIsGoogleProcessing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const firestore = useFirestore();

  // If already logged in as super-admin, redirect directly to dashboard
  useEffect(() => {
    if (isUserLoading) return;
    if (user) {
      const emailLower = user.email?.toLowerCase().trim();
      if (emailLower === SUPER_ADMIN_EMAIL || user.uid === SUPER_ADMIN_UID) {
        router.replace('/admin-imamshaffy');
      }
    }
  }, [user, isUserLoading, router]);

  // Check URL query parameters for unauthorized redirect feedback
  useEffect(() => {
    if (searchParams.get('error') === 'unauthorized') {
      const msg = `Access restricted: Only ${SUPER_ADMIN_EMAIL} is authorized to access the Admin Command Center.`;
      setError(msg);
      toast({
        title: 'Unauthorized Access',
        description: msg,
        variant: 'destructive',
      });
    }
  }, [searchParams, toast]);

  const handleGoogleSignIn = async () => {
    if (!auth) return;
    setIsGoogleProcessing(true);
    setError(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      
      const signedInEmail = result.user.email?.toLowerCase().trim();
      const signedInUid = result.user.uid;

      if (signedInEmail !== SUPER_ADMIN_EMAIL && signedInUid !== SUPER_ADMIN_UID) {
        // Immediately kick out unauthorized accounts
        await signOut(auth);
        const deniedMsg = `Access Denied: ${signedInEmail || 'This account'} is not permitted. Only ${SUPER_ADMIN_EMAIL} can access this dashboard.`;
        setError(deniedMsg);
        toast({
          title: 'Super-Admin Access Denied',
          description: deniedMsg,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Authentication Verified',
        description: `Welcome back, Super Admin (${signedInEmail}). Redirecting...`,
      });
      router.push('/admin-imamshaffy');
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in popup was cancelled.');
      } else {
        console.error('Google Sign-in error:', err);
        setError(err.message || 'Google authentication failed.');
      }
    } finally {
      setIsGoogleProcessing(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const normalizedEmail = email.toLowerCase().trim();

    // Enforce email restriction at client guard
    if (normalizedEmail !== SUPER_ADMIN_EMAIL) {
      const msg = `Unauthorized email. Access is strictly limited to ${SUPER_ADMIN_EMAIL}.`;
      setError(msg);
      toast({ title: 'Access Denied', description: msg, variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    setError(null);

    const lockRef = doc(firestore, 'admin_locks', normalizedEmail);

    try {
      // 1. Check for existing lockout
      const lockSnap = await getDoc(lockRef);
      if (lockSnap.exists()) {
        const data = lockSnap.data();
        if (data.lockoutUntil) {
          const lockoutDate = data.lockoutUntil.toDate();
          if (lockoutDate > new Date()) {
            const timeRemaining = formatDistanceToNow(lockoutDate);
            const message = `Too many failed attempts. This account is locked for ${timeRemaining}. Please try again later.`;
            setError(message);
            toast({ title: 'Account Locked', description: message, variant: 'destructive' });
            setIsProcessing(false);
            return;
          }
        }
      }

      // 2. Attempt Login
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      
      if (userCredential.user.email?.toLowerCase().trim() !== SUPER_ADMIN_EMAIL && userCredential.user.uid !== SUPER_ADMIN_UID) {
        await signOut(auth);
        setError(`Access Denied: Only ${SUPER_ADMIN_EMAIL} is authorized.`);
        return;
      }

      // 3. Success: Reset lockout attempts
      try {
        await deleteDoc(lockRef);
      } catch {
        /* non-fatal */
      }
      
      toast({ title: 'Login Successful', description: 'Redirecting to admin command center...' });
      router.push('/admin-imamshaffy');
    } catch (err: any) {
      let message = 'An unexpected error occurred. Please try again.';
      
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        message = 'Invalid password for super-admin account.';
        
        // Failure: Increment attempts
        try {
          const lockSnap = await getDoc(lockRef);
          const currentData = lockSnap.exists() ? lockSnap.data() : { attempts: 0 };
          const newAttempts = (currentData.attempts || 0) + 1;
          
          if (newAttempts >= 5) {
            const lockoutUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await setDoc(lockRef, {
              attempts: newAttempts,
              lockoutUntil: Timestamp.fromDate(lockoutUntil),
              lastAttempt: serverTimestamp()
            });
            message = 'Too many failed attempts. Account locked for 24 hours.';
          } else {
            await setDoc(lockRef, {
              attempts: newAttempts,
              lastAttempt: serverTimestamp()
            }, { merge: true });
            message = `Invalid credentials. ${5 - newAttempts} attempt(s) remaining before lockout.`;
          }
        } catch (lockErr) {
          console.error("Error updating lockout status:", lockErr);
        }
      } else if (err.code === 'auth/invalid-email') {
        message = 'The email address is not valid.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Too many requests. Please try again later or use Google Sign-in.';
      }

      setError(message);
      toast({
        title: 'Authentication Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex lg:grid lg:grid-cols-2 bg-background">
      <div className="flex items-center justify-center min-h-screen p-6 w-full">
        <Card className="w-full max-w-md shadow-2xl border border-border/60 bg-card">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 gap-1.5 py-1 px-2.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Super Admin Portal
              </Badge>
              <span className="text-[11px] font-mono text-muted-foreground">v3.4 Production</span>
            </div>
            <CardTitle className="text-2xl font-black tracking-tight">Admin Authentication</CardTitle>
            <CardDescription className="text-xs text-muted-foreground leading-relaxed">
              Restricted platform command center. Authorized access only for <span className="font-semibold text-foreground">{SUPER_ADMIN_EMAIL}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Google 1-Click Sign-in */}
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={isGoogleProcessing || isProcessing}
                className="w-full h-11 border-border/80 hover:bg-accent/60 font-semibold text-sm flex items-center justify-center gap-2.5 shadow-sm transition-all"
              >
                {isGoogleProcessing ? (
                  <Loader className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                )}
                <span>Continue with Google</span>
              </Button>
              <p className="text-[11px] text-center text-muted-foreground">
                Instant authorization for <strong className="text-foreground font-mono">{SUPER_ADMIN_EMAIL}</strong>
              </p>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-border w-full" />
              <span className="bg-card px-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Or with password
              </span>
            </div>

            {/* Email & Password Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold">Admin Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isProcessing || isGoogleProcessing}
                  placeholder={SUPER_ADMIN_EMAIL}
                  autoComplete="email"
                  className="bg-muted/30 font-mono text-xs h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold">Master Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isProcessing || isGoogleProcessing}
                    placeholder="Enter admin password"
                    autoComplete="current-password"
                    className="bg-muted/30 text-xs h-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-11 font-bold text-xs" 
                disabled={isProcessing || isGoogleProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Verifying Credentials...
                  </>
                ) : (
                  'Access Command Dashboard'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="hidden bg-muted lg:block relative overflow-hidden">
        <Image
          src="/zeneva-login.png?v=2"
          alt="Modern retail store interior with minimalist design and warm lighting."
          width="1920"
          height="1080"
          quality={100}
          priority
          className="h-full w-full object-cover transform transition-transform [transition-duration:30s] ease-in-out hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 p-0 bg-transparent">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs uppercase tracking-widest font-mono text-emerald-400 font-bold">Secure Command Core</span>
          </div>
          <h2 className="text-white text-4xl font-extrabold font-headline leading-tight tracking-tight drop-shadow-lg">
            ZenOffice <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Intelligence</span>
          </h2>
          <p className="text-white/80 mt-3 text-base font-light leading-relaxed drop-shadow-md max-w-[560px]">
             Live telemetry across Microsoft Store desktop apps, native cross-platform devices, and cloud synchronization.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <div className="h-1 w-12 bg-primary rounded-full shadow-[0_0_10px_rgba(255,165,0,0.5)]" />
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-[0.25em]">Single-Tenant Super Admin</span>
          </div>
        </div>
      </div>
    </div>
  );
}
