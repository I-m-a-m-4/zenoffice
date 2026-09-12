'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { X, Camera, Zap, ZapOff, RefreshCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';

interface BarcodeScannerProps {
    onScan: (decodedText: string) => void;
    isOpen: boolean;
    onClose: () => void;
}

export function BarcodeScanner({ onScan, isOpen, onClose }: BarcodeScannerProps) {
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [hasCamera, setHasCamera] = useState<boolean | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);

    const scannerInstanceRef = useRef<Html5Qrcode | null>(null);
    const scannerRef = useRef<HTMLDivElement>(null);
    const lastScannedRef = useRef<string | null>(null);
    const lastScannedTimeRef = useRef<number>(0);
    const isStoppingRef = useRef(false);
    const sessionScannedRef = useRef(false);

    useEffect(() => {
        let isInstanceActive = true;
        sessionScannedRef.current = false; // Reset session guard when dialog state changes

        const initScanner = async () => {
            // Wait for Dialog to be fully mounted
            await new Promise(resolve => setTimeout(resolve, 600));

            if (isOpen && isInstanceActive && !scannerInstanceRef.current) {
                try {
                    // Robust check: Wait until the element is present in the DOM
                    let element = document.getElementById("barcode-reader");
                    let retries = 0;
                    while (!element && retries < 10 && isInstanceActive) {
                        await new Promise(resolve => setTimeout(resolve, 200));
                        element = document.getElementById("barcode-reader");
                        retries++;
                    }

                    if (!element) {
                        throw new Error("Scanner container element ('barcode-reader') not found in DOM.");
                    }

                    const newScanner = new Html5Qrcode("barcode-reader", {
                        formatsToSupport: [
                            Html5QrcodeSupportedFormats.EAN_13,
                            Html5QrcodeSupportedFormats.EAN_8,
                            Html5QrcodeSupportedFormats.CODE_128,
                            Html5QrcodeSupportedFormats.CODE_39,
                            Html5QrcodeSupportedFormats.UPC_A,
                            Html5QrcodeSupportedFormats.UPC_E,
                            Html5QrcodeSupportedFormats.QR_CODE
                        ],
                        verbose: false
                    });
                    scannerInstanceRef.current = newScanner;
                    await startScanning(newScanner);
                } catch (err) {
                    console.error("Scanner init error", err);
                    if (isInstanceActive) setCameraError("Failed to initialize scanner. Please try again.");
                }
            }
        };

        if (isOpen) {
            initScanner();
        }

        return () => {
            isInstanceActive = false;
            if (scannerInstanceRef.current) {
                const s = scannerInstanceRef.current;
                s.stop().catch(e => console.error("Cleanup stop error", e));
                scannerInstanceRef.current = null;
            }
        };
    }, [isOpen]);
    // Note: 'scanner' is excluded from deps to prevent infinite loops, 
    // we use the local variable inside the effect or handleClose.

    const startScanning = async (scannerInstance: Html5Qrcode) => {
        setIsStarting(true);
        setCameraError(null);
        try {
            // Force permission prompt natively before attempting to list cameras
            // This is required for mobile webviews and Tauri apps to trigger the OS dialog
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    let stream;
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                    } catch {
                        stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    }
                    if (stream) {
                        stream.getTracks().forEach(track => track.stop());
                    }
                } catch (permissionErr) {
                    console.warn("Explicit getUserMedia failed:", permissionErr);
                    throw new Error("Camera permission denied or not available. Please allow access.");
                }
            }

            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
                setHasCamera(true);
                // Prefer back camera
                const backCamera = devices.find(device =>
                    device.label.toLowerCase().includes('back') ||
                    device.label.toLowerCase().includes('rear')
                );
                const cameraId = backCamera ? backCamera.id : devices[0].id;

                await scannerInstance.start(
                    cameraId,
                    {
                        fps: 15, // Increase FPS for faster scanning
                        qrbox: (viewfinderWidth, viewfinderHeight) => {
                            // Responsive rectangular qrbox
                            const width = Math.min(viewfinderWidth * 0.8, 300);
                            const height = Math.min(viewfinderHeight * 0.4, 180);
                            return { width, height };
                        },
                        aspectRatio: 1.0,
                    },
                    (decodedText) => {
                        // 1. SESSION GUARD - The most important check
                        if (sessionScannedRef.current) return;
                        sessionScannedRef.current = true;

                        // 2. COOLDOWN GUARD (for same item)
                        const now = Date.now();
                        if (decodedText === lastScannedRef.current && (now - lastScannedTimeRef.current) < 2000) {
                            sessionScannedRef.current = false; // allow it to try again if it was too fast
                            return;
                        }

                        lastScannedRef.current = decodedText;
                        lastScannedTimeRef.current = now;

                        // 3. STOP IMMEDIATELY
                        handleClose();

                        // 4. BEEP & FEEDBACK
                        try {
                            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                            if (audioCtx) {
                                const oscillator = audioCtx.createOscillator();
                                const gainNode = audioCtx.createGain();

                                oscillator.type = 'sine';
                                oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
                                oscillator.connect(gainNode);
                                gainNode.connect(audioCtx.destination);

                                gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                                gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.05);
                                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

                                oscillator.start(audioCtx.currentTime);
                                oscillator.stop(audioCtx.currentTime + 0.2);
                            }
                        } catch (e) { }

                        if (window.navigator.vibrate) {
                            window.navigator.vibrate(200);
                        }

                        // 5. NOTIFY PARENT LAST - with delay to ensure UI is ready
                        setTimeout(() => onScan(decodedText), 100);
                    },
                    (errorMessage) => {
                        // Error is noisy, ignore
                    }
                );
            } else {
                setHasCamera(false);
                setCameraError("No camera found on this device.");
            }
        } catch (err) {
            console.error("Error starting camera", err);
            setCameraError("Could not access camera. Please check permissions.");
        } finally {
            setIsStarting(false);
        }
    };

    const toggleTorch = async () => {
        if (scannerInstanceRef.current && scannerInstanceRef.current.getState() === 2) { // 2 is SCANNING
            try {
                const newState = !isTorchOn;
                await scannerInstanceRef.current.applyVideoConstraints({
                    // @ts-ignore
                    advanced: [{ torch: newState }]
                });
                setIsTorchOn(newState);
            } catch (err) {
                console.error("Error toggling torch", err);
            }
        }
    };

    const handleClose = async () => {
        if (isStoppingRef.current) return;
        isStoppingRef.current = true;

        setIsStarting(false);
        setCameraError(null);

        if (scannerInstanceRef.current) {
            try {
                if (scannerInstanceRef.current.getState() === 2) { // SCANNING
                    await scannerInstanceRef.current.stop();
                }
            } catch (e) {
                console.error("Stop error during close", e);
            } finally {
                scannerInstanceRef.current = null;
            }
        }

        isStoppingRef.current = false;
        onClose();
    };

    const handleTryAgain = async () => {
        setCameraError(null);
        setIsStarting(true);
        try {
            // Wait for Dialog to be fully mounted
            let element = document.getElementById("barcode-reader");
            let retries = 0;
            while (!element && retries < 10) {
                await new Promise(resolve => setTimeout(resolve, 200));
                element = document.getElementById("barcode-reader");
                retries++;
            }

            if (!element) {
                throw new Error("Scanner container element ('barcode-reader') not found in DOM.");
            }

            if (!scannerInstanceRef.current) {
                const newScanner = new Html5Qrcode("barcode-reader", {
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.EAN_8,
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.CODE_39,
                        Html5QrcodeSupportedFormats.UPC_A,
                        Html5QrcodeSupportedFormats.UPC_E,
                        Html5QrcodeSupportedFormats.QR_CODE
                    ],
                    verbose: false
                });
                scannerInstanceRef.current = newScanner;
                await startScanning(newScanner);
            } else {
                await startScanning(scannerInstanceRef.current);
            }
        } catch (err) {
            console.error("Try again error", err);
            setCameraError("Could not access camera. Please check permissions.");
        } finally {
            setIsStarting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="p-0 overflow-hidden bg-black border-none h-full sm:h-[80vh] sm:max-w-xl max-w-none w-full gap-0">
                <DialogHeader className="p-4 bg-zinc-900/60 backdrop-blur-md absolute top-0 left-0 right-0 z-50 flex flex-row items-center justify-between text-white border-b border-white/10 space-y-0">
                    <DialogTitle className="text-lg font-medium">Scan Barcode</DialogTitle>
                    <Button variant="ghost" size="icon" onClick={handleClose} className="text-white hover:bg-white/10 rounded-full h-8 w-8">
                        <X className="h-5 w-5" />
                    </Button>
                </DialogHeader>

                <div ref={scannerRef} className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden sm:mt-0 z-0">
                    <div id="barcode-reader" className="w-full h-full [&>video]:object-cover" />

                    {/* Custom Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        {/* Scanning Area Frame */}
                        <div className="relative w-[280px] h-[160px]">
                            {/* Corners */}
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500 rounded-tl-lg" />
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500 rounded-tr-lg" />
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500 rounded-bl-lg" />
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500 rounded-br-lg" />

                            {/* Scanning Line */}
                            <motion.div
                                animate={{ top: ['10%', '90%'] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                className="absolute left-2 right-2 h-0.5 bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.8)] z-10"
                            />
                        </div>

                        {/* Darkened area outside the scanner box */}
                        <div className="absolute inset-0 bg-black/40" style={{
                            clipPath: 'polygon(0% 0%, 0% 100%, 5% 100%, 5% 5%, 95% 5%, 95% 95%, 5% 95%, 5% 100%, 100% 100%, 100% 0%)'
                        }} />
                    </div>

                    {/* Camera Controls */}
                    <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-6 z-20">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={toggleTorch}
                            className="bg-zinc-900/80 border-white/10 text-white rounded-full h-14 w-14 backdrop-blur-md hover:bg-zinc-800"
                        >
                            {isTorchOn ? <ZapOff className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
                        </Button>

                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => scannerInstanceRef.current && startScanning(scannerInstanceRef.current)}
                            className="bg-zinc-900/80 border-white/10 text-white rounded-full h-14 w-14 backdrop-blur-md hover:bg-zinc-800"
                        >
                            <RefreshCcw className="h-6 w-6" />
                        </Button>
                    </div>

                    {/* Loading / Error States */}
                    <AnimatePresence>
                        {isStarting && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-black flex flex-col items-center justify-center z-30"
                            >
                                <Camera className="h-10 w-10 text-orange-500 animate-pulse mb-4" />
                                <p className="text-white/70 text-sm font-medium">Initializing camera...</p>
                            </motion.div>
                        )}

                        {cameraError && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center z-40 p-6 text-center"
                            >
                                <div className="bg-red-500/10 p-4 rounded-full mb-4">
                                    <Camera className="h-8 w-8 text-red-500" />
                                </div>
                                <h3 className="text-white font-semibold mb-2">Camera Access Error</h3>
                                <p className="text-white/60 text-sm mb-6 max-w-[250px]">{cameraError}</p>
                                <Button onClick={handleTryAgain} variant="secondary" className="rounded-full">
                                    Try Again
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="p-6 bg-zinc-950 text-center">
                    <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Align barcode within the frame to scan</p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
