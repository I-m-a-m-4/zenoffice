'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmailAndPassword } from 'firebase/auth';
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
import { Eye, EyeOff, Loader } from 'lucide-react';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();

  const firestore = useFirestore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsProcessing(true);
    setError(null);

    const lockRef = doc(firestore, 'admin_locks', email.toLowerCase());

    try {
      // 1. Check for existing lockout
      const lockSnap = await getDoc(lockRef);
      if (lockSnap.exists()) {
        const data = lockSnap.data();
        if (data.lockoutUntil) {
          const lockoutDate = data.lockoutUntil.toDate();
          if (lockoutDate > new Date()) {
            const timeRemaining = formatDistanceToNow(lockoutDate);
            const message = `Too many failed attempts. This account is locked for ${timeRemaining}. Please try again tomorrow.`;
            setError(message);
            toast({ title: 'Account Locked', description: message, variant: 'destructive' });
            setIsProcessing(false);
            return;
          }
        }
      }

      // 2. Attempt Login
      await signInWithEmailAndPassword(auth, email, password);
      
      // 3. Success: Reset lockout attempts
      await deleteDoc(lockRef);
      
      toast({ title: 'Login Successful', description: 'Redirecting to admin dashboard...' });
      router.push('/admin-imamshaffy');
    } catch (err: any) {
      let message = 'An unexpected error occurred. Please try again.';
      
      // Handle Firebase Auth errors
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        message = 'Invalid credentials. Please check your email and password.';
        
        // 4. Failure: Increment attempts
        try {
          const lockSnap = await getDoc(lockRef);
          const currentData = lockSnap.exists() ? lockSnap.data() : { attempts: 0 };
          const newAttempts = (currentData.attempts || 0) + 1;
          
          if (newAttempts >= 5) {
            // Lock for 24 hours
            const lockoutUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await setDoc(lockRef, {
              attempts: newAttempts,
              lockoutUntil: Timestamp.fromDate(lockoutUntil),
              lastAttempt: serverTimestamp()
            });
            message = 'Too many failed attempts. This account has been locked until tomorrow.';
          } else {
            await setDoc(lockRef, {
              attempts: newAttempts,
              lastAttempt: serverTimestamp()
            }, { merge: true });
            message = `Invalid credentials. ${5 - newAttempts} attempts remaining before lockout.`;
          }
        } catch (lockErr) {
          console.error("Error updating lockout status:", lockErr);
        }
      } else if (err.code === 'auth/invalid-email') {
        message = 'The email address is not valid.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Too many requests. Please try again later or tomorrow.';
      }

      setError(message);
      toast({
        title: 'Login Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex lg:grid lg:grid-cols-2">
      <div className="flex items-center justify-center min-h-screen bg-background p-6">
        <Card className="w-full max-w-md shadow-2xl border-white/5">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Admin Login</CardTitle>
            <CardDescription className="text-muted-foreground">Enter your admin credentials to access the dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2 focus-within-glow rounded-md">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isProcessing}
                  placeholder="admin@zeneva.com"
                  autoComplete="off"
                  className="bg-muted/30"
                />
              </div>
              <div className="space-y-2 focus-within-glow rounded-md">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isProcessing}
                    placeholder="Enter your password"
                    autoComplete="off"
                    className="bg-muted/30"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {error && <p className="text-sm text-destructive font-medium">{error}</p>}
              <Button type="submit" className="w-full button-glow py-6" disabled={isProcessing}>
                {isProcessing && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                {isProcessing ? 'Verifying Credentials...' : 'Access Dashboard'}
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
          className="h-full w-full object-cover transform transition-transform [transition-duration:30s] ease-in-out hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 p-0 bg-transparent">
          <h2 className="text-white text-4xl font-bold font-headline leading-tight tracking-tight drop-shadow-lg">
            Zen Command <span className="text-primary">Center</span>
          </h2>
          <p className="text-white/90 mt-4 text-xl font-light leading-relaxed drop-shadow-md max-w-[600px]">
             Manage the heartbeat of Zeneva. Monitor platform growth, oversee business health, and coordinate strategic outreach from one secure intelligence hub.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <div className="h-1.5 w-12 bg-primary rounded-full shadow-[0_0_10px_rgba(255,165,0,0.5)]" />
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-[0.3em] drop-shadow-sm">Command Hub v2.4</span>
          </div>
        </div>
      </div>
    </div>
  );
}
