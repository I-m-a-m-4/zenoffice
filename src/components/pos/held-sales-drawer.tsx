'use client';

import * as React from 'react';
import { usePOS } from '@/context/pos-context';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Archive, Trash2, Play, User, Clock, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CURRENCY_SYMBOLS } from '@/lib/constants';
import { motion, AnimatePresence } from 'framer-motion';

import { createPortal } from 'react-dom';

interface HeldSalesDrawerProps {
    trigger?: React.ReactNode;
}

export default function HeldSalesDrawer({ trigger }: HeldSalesDrawerProps) {
    const { heldSales, resumeHeldSale, deleteHeldSale, business } = usePOS();
    const [isOpen, setIsOpen] = React.useState(false);
    const [isMounted, setIsMounted] = React.useState(false);
    const currencySymbol = CURRENCY_SYMBOLS[business?.currency || 'NGN'] || '₦';

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleResume = (id: string) => {
        resumeHeldSale(id);
        setIsOpen(false);
    };

    return (
        <>
            {isMounted && isOpen && createPortal(
                <div 
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] transition-opacity animate-in fade-in-0" 
                    onClick={() => setIsOpen(false)} 
                />,
                document.body
            )}
            <Sheet open={isOpen} onOpenChange={setIsOpen} modal={false}>
                <SheetTrigger asChild>
                    {trigger || (
                        <Button variant="ghost" size="icon" className="relative">
                            <History className="h-5 w-5" />
                            {isMounted && heldSales.length > 0 && (
                                <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px] bg-primary text-primary-foreground rounded-full border border-background font-bold">
                                    {heldSales.length}
                                </span>
                            )}
                        </Button>
                    )}
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-[540px]">
                <SheetHeader className="pt-2.5 pr-12 pb-1 select-none">
                    <SheetTitle className="flex items-center gap-2 text-lg tracking-tight font-black">
                        <Archive className="h-5 w-5 text-primary" />
                        Parked Sales
                    </SheetTitle>
                    <SheetDescription className="text-[11px] mt-0.5">
                        View and resume transactions you've put on hold.
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
                    <AnimatePresence mode="popLayout" initial={false}>
                        {heldSales.length === 0 ? (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground"
                            >
                                <Archive className="h-12 w-12 opacity-20 mb-4" />
                                <p>No parked sales found.</p>
                            </motion.div>
                        ) : (
                            <div className="space-y-4">
                                {heldSales.map((sale) => (
                                    <motion.div 
                                        key={sale.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9, x: -20 }}
                                        transition={{ duration: 0.2 }}
                                        className="p-4 rounded-xl border bg-card hover:shadow-md transition-all group"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className="font-semibold text-sm">
                                                        {sale.customer?.name || 'Walk-in Customer'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    <span>{formatDistanceToNow(sale.timestamp, { addSuffix: true })}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-lg">{currencySymbol}{sale.total.toLocaleString()}</div>
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{sale.items.length} items</div>
                                            </div>
                                        </div>

                                        {sale.notes && (
                                            <div className="mb-3 p-2 bg-muted/50 rounded text-xs italic text-muted-foreground">
                                                "{sale.notes}"
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 mt-2">
                                            <Button 
                                                className="flex-1 h-9 gap-2 shadow-sm" 
                                                onClick={() => handleResume(sale.id)}
                                            >
                                                <Play className="h-3.5 w-3.5 fill-current" />
                                                Resume Sale
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                size="icon" 
                                                className="h-9 w-9 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteHeldSale(sale.id);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </AnimatePresence>
                </ScrollArea>
            </SheetContent>
        </Sheet>
        </>
    );
}
