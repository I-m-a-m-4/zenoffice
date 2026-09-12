'use client';

import * as React from 'react';
import { Camera, Loader2, Plus, X, Check, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { visualCount, VisualCountOutput } from '@/ai/flows/visual-count-flow';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { idToken } from '@/lib/id-token';

interface VisualCountDialogProps {
    onAddItems: (items: { name: string; quantity: number }[]) => Promise<void>;
}

export default function VisualCountDialog({ onAddItems }: VisualCountDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [step, setStep] = React.useState<'capture' | 'analyzing' | 'review'>('capture');
    const [imagePreview, setImagePreview] = React.useState<string | null>(null);
    const [foundItems, setFoundItems] = React.useState<{ name: string; quantity: number }[]>([]);
    const [isAnalyzing, setIsAnalyzing] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // Reset state when dialog opens/closes
    React.useEffect(() => {
        if (!open) {
            setTimeout(() => {
                setStep('capture');
                setImagePreview(null);
                setFoundItems([]);
                setIsAnalyzing(false);
            }, 300);
        }
    }, [open]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setImagePreview(base64String);
                setStep('analyzing');
                analyzeImage(base64String);
            };
            reader.readAsDataURL(file);
        }
    };

    const analyzeImage = async (base64Image: string) => {
        setIsAnalyzing(true);
        try {
            // Remove the data URL prefix (e.g., "data:image/jpeg;base64,") for the AI text input if needed,
            // but Genkit/Gemini often handles the full string or needs just the base64 part.
            // Let's strip the prefix just to be safe for the server action input schema.
            const base64Data = base64Image.split(',')[1];

            const result = await visualCount({ imageBase64: base64Data }, await idToken());

            if (result && result.items) {
                setFoundItems(result.items.map(item => ({ name: item.name, quantity: item.count })));
                setStep('review');
            } else {
                toast({
                    title: "No items found",
                    description: "Could not identify any products. Please try again.",
                    variant: "destructive"
                });
                setStep('capture');
            }
        } catch (error) {
            console.error("Visual count error:", error);
            toast({
                title: "Analysis failed",
                description: "Something went wrong while analyzing the image.",
                variant: "destructive"
            });
            setStep('capture');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleUpdateItem = (index: number, field: 'name' | 'quantity', value: string | number) => {
        const newItems = [...foundItems];
        if (field === 'name') {
            newItems[index].name = value as string;
        } else {
            newItems[index].quantity = Number(value);
        }
        setFoundItems(newItems);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...foundItems];
        newItems.splice(index, 1);
        setFoundItems(newItems);
    };

    const handleAddNewRow = () => {
        setFoundItems([...foundItems, { name: "New Item", quantity: 1 }]);
    };

    const handleSave = async () => {
        try {
            await onAddItems(foundItems);
            toast({
                title: "Inventory Updated",
                description: `Added ${foundItems.length} distinct items to inventory.`,
            });
            setOpen(false);
        } catch (error) {
            toast({
                title: "Save failed",
                description: "Could not add items to inventory.",
                variant: "destructive"
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Camera className="h-4 w-4" />
                    <span className="hidden sm:inline">Visual Count</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Visual Stock Count</DialogTitle>
                    <DialogDescription>
                        Take a photo of your shelves or products to automatically count them.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4">
                    {step === 'capture' && (
                        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg bg-muted/50 gap-4">
                            <div className="bg-background p-4 rounded-full shadow-sm">
                                <Camera className="h-8 w-8 text-primary" />
                            </div>
                            <div className="text-center">
                                <p className="font-medium">Tap to take a photo</p>
                                <p className="text-sm text-muted-foreground">or upload from gallery</p>
                            </div>
                            <Button onClick={() => fileInputRef.current?.click()}>
                                Open Camera / Gallery
                            </Button>
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                        </div>
                    )}

                    {step === 'analyzing' && (
                        <div className="flex flex-col items-center justify-center p-8 gap-6">
                            {imagePreview && (
                                <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-md">
                                    <Image src={imagePreview} alt="Preview" fill className="object-cover opacity-50" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                    </div>
                                </div>
                            )}
                            <p className="text-lg font-medium animate-pulse">Identifying products...</p>
                        </div>
                    )}

                    {step === 'review' && (
                        <div className="space-y-6">
                            {imagePreview && (
                                <div className="relative w-full h-32 rounded-lg overflow-hidden shrink-0">
                                    <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                                </div>
                            )}

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Product Name</TableHead>
                                            <TableHead className="w-[100px]">Qty</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {foundItems.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                                                    No items detected. Try adding one manually.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            foundItems.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>
                                                        <Input
                                                            value={item.name}
                                                            onChange={(e) => handleUpdateItem(index, 'name', e.target.value)}
                                                            className="h-8"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)}
                                                            className="h-8"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveItem(index)}>
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleAddNewRow} className="w-full">
                                <Plus className="h-4 w-4 mr-2" /> Add Missing Item
                            </Button>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    {step === 'review' && (
                        <>
                            <Button variant="outline" onClick={() => setStep('capture')}>
                                Retake Photo
                            </Button>
                            <Button onClick={handleSave} className="gap-2">
                                <Save className="h-4 w-4" />
                                Add {foundItems.reduce((acc, item) => acc + item.quantity, 0)} Items
                            </Button>
                        </>
                    )}
                    {step === 'capture' && (
                        <Button variant="ghost" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
