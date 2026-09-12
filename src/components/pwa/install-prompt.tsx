'use native';
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Share, Download } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { usePWA } from '@/context/pwa-context';

export default function InstallPrompt() {
    const { promptInstall, isInstallable, isAppInstalled } = usePWA();
    const [showInstallModal, setShowInstallModal] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    // Disable automatic install prompt as requested
    return null;

    useEffect(() => {
        // Check if device is iOS
        const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(isIosDevice);

        const isDismissed = localStorage.getItem('pwa-prompt-dismissed') === 'true';

        // Check if current path is a storefront path
        const isStorefront = window.location.pathname.startsWith('/store') || window.location.hostname.includes('shop.');

        // Show modal if installable, not installed, not dismissed, and NOT a storefront.
        // Also show for iOS since we can't detect "installable" event there easily, but we check if it's NOT standalone
        const shouldShow = (isInstallable || (isIosDevice && !isAppInstalled)) && !isAppInstalled && !isDismissed && !isStorefront;

        if (shouldShow) {
            setShowInstallModal(true);
        }
    }, [isInstallable, isAppInstalled]);

    const handleInstallClick = async () => {
        await promptInstall();
        setShowInstallModal(false);
    };

    const handleDismiss = () => {
        setShowInstallModal(false);
        localStorage.setItem('pwa-prompt-dismissed', 'true');
    };

    if (!showInstallModal) return null;

    return (
        <Dialog open={showInstallModal} onOpenChange={setShowInstallModal}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Install App</DialogTitle>
                    <DialogDescription>
                        Install this app on your device for a better experience.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center space-x-2">
                        {isIOS ? (
                            <div className="space-y-4 text-sm text-muted-foreground w-full">
                                <p>To install this app on your iPhone/iPad:</p>
                                <ol className="list-decimal list-inside space-y-2">
                                    <li>Tap the <Share className="inline h-4 w-4" /> Share button in your browser menu.</li>
                                    <li>Scroll down and tap "Add to Home Screen".</li>
                                </ol>
                                <Button variant="outline" onClick={handleDismiss} className="w-full mt-2">
                                    Maybe Later
                                </Button>
                            </div>
                        ) : (
                            <div className="grid gap-4 py-4 w-full">
                                <p className="text-sm text-muted-foreground">
                                    Get quick access to Zeneva directly from your home screen.
                                </p>
                                <Button onClick={handleInstallClick} className="w-full">
                                    <Download className="mr-2 h-4 w-4" /> Install App
                                </Button>
                                <Button variant="outline" onClick={handleDismiss} className="w-full">
                                    Maybe Later
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
