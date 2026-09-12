'use client';

import React, { useState, useEffect } from 'react';
import * as OTPAuth from 'otpauth';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, Lock, Loader } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirestore, useUser } from '@/firebase';
import { withFirestoreRetry } from '@/firebase/retry';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

const ADMIN_EMAIL = 'belloimam431@gmail.com';

interface Admin2FAGateProps {
    children: React.ReactNode;
}

export default function Admin2FAGate({ children }: Admin2FAGateProps) {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const [isVerified, setIsVerified] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [setupMode, setSetupMode] = useState(false);
    const [secret, setSecret] = useState('');
    const [otp, setOtp] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState('');

    useEffect(() => {
        if (isUserLoading) return;

        if (user?.email !== ADMIN_EMAIL) {
            setIsLoading(false);
            return;
        }

        const sessionVerified = sessionStorage.getItem('zeneva_admin_verified');
        if (sessionVerified === 'true') {
            setIsVerified(true);
            setIsLoading(false);
            return;
        }

        checkSecurityStatus();
    }, [user, isUserLoading]);

    const checkSecurityStatus = async () => {
        try {
            const securityDoc = await withFirestoreRetry(
                () => getDoc(doc(firestore, 'admin_config', 'totp')),
                { label: 'Admin 2FA config' },
            );
            if (securityDoc.exists()) {
                setSecret(securityDoc.data().secret);
                setSetupMode(false);
            } else {
                setSetupMode(true);
                generateNewSecret();
            }
        } catch (error) {
            console.error('Error checking security status:', error);
            toast({
                variant: 'destructive',
                title: 'Security Error',
                description: 'Failed to connect to security server.'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const generateNewSecret = () => {
        const newSecretObj = new OTPAuth.Secret();
        const newSecret = newSecretObj.base32;
        setSecret(newSecret);
        
        const totp = new OTPAuth.TOTP({
            issuer: 'Zeneva Platform',
            label: ADMIN_EMAIL,
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: newSecretObj,
        });
        
        setQrCodeUrl(totp.toString());
    };

    const handleVerify = async () => {
        setIsProcessing(true);
        try {
            const totpInstance = new OTPAuth.TOTP({
                issuer: 'Zeneva Platform',
                label: ADMIN_EMAIL,
                algorithm: 'SHA1',
                digits: 6,
                period: 30,
                secret: OTPAuth.Secret.fromBase32(secret),
            });

            const delta = totpInstance.validate({
                token: otp,
                window: 1,
            });

            if (delta !== null) {
                if (setupMode) {
                    await setDoc(doc(firestore, 'admin_config', 'totp'), {
                        secret: secret,
                        updatedAt: new Date(),
                        updatedBy: user?.uid
                    });
                }
                
                sessionStorage.setItem('zeneva_admin_verified', 'true');
                setIsVerified(true);
                toast({
                    title: 'Access Granted',
                    description: 'Identity verified successfully.',
                });
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Invalid Code',
                    description: 'The verification code is incorrect.'
                });
            }
        } catch (error) {
            console.error('Verification error:', error);
            toast({
                variant: 'destructive',
                title: 'System Error',
                description: 'An error occurred during verification.'
            });
        } finally {
            setIsProcessing(false);
            setOtp('');
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-[400px] w-full items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground font-medium">Initializing Security Protocol...</p>
                </div>
            </div>
        );
    }

    if (user?.email !== ADMIN_EMAIL || isVerified) {
        return <>{children}</>;
    }

    return (
        <div className="flex items-center justify-center min-h-[600px] py-10">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md px-4"
            >
                <Card className="border-2 shadow-2xl bg-card">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                            <Shield className="h-8 w-8 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-bold tracking-tight">
                            {setupMode ? 'Initialize Security' : 'Admin Verification'}
                        </CardTitle>
                        <CardDescription>
                            {setupMode 
                                ? 'Scan the QR code below with Google Authenticator or Authy.' 
                                : 'Enter the 6-digit code from your authenticator app.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {setupMode && qrCodeUrl && (
                            <div className="flex flex-col items-center gap-4 rounded-xl bg-white p-6 shadow-inner border">
                                <QRCodeSVG value={qrCodeUrl} size={180} level="H" />
                                <div className="text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Manual Setup Key</p>
                                    <code className="bg-slate-100 px-3 py-1 rounded text-xs font-mono text-slate-600 select-all">
                                        {secret.match(/.{1,4}/g)?.join(' ')}
                                    </code>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="000000"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="pl-10 h-12 text-center text-xl font-mono tracking-[0.5em]"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && otp.length === 6 && handleVerify()}
                                />
                            </div>
                            <p className="text-[10px] text-center text-muted-foreground">
                                Codes refresh every 30 seconds
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button 
                            className="w-full h-12 text-base font-bold shadow-lg" 
                            disabled={otp.length !== 6 || isProcessing}
                            onClick={handleVerify}
                        >
                            {isProcessing ? (
                                <Loader className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                setupMode ? 'Verify and Save' : 'Unlock Dashboard'
                            )}
                        </Button>
                    </CardFooter>
                </Card>
                <p className="mt-6 text-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">
                    Secure Zeneva Retail OS Command
                </p>
            </motion.div>
        </div>
    );
}
