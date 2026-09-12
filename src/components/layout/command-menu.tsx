'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Home, Package, ShoppingCart, Users, LifeBuoy, CreditCard, Settings, FileText, Bot, Wallet, Truck } from 'lucide-react';
import { usePOS } from '@/context/pos-context';

interface CommandMenuProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: Home, roles: ['admin', 'manager', 'vendor_operator'] },
    { href: '/inventory', label: 'Inventory', icon: Package, roles: ['admin', 'manager', 'vendor_operator'] },
    { href: '/sales/pos/select-products', label: 'Point of Sale', icon: ShoppingCart, roles: ['admin', 'manager', 'vendor_operator'] },
    { href: '/expenses', label: 'Expenses & Operating Costs', icon: Wallet, roles: ['admin', 'manager', 'vendor_operator'] },
    { href: '/expenses?tab=purchases', label: 'Purchases & Restock Orders', icon: Truck, roles: ['admin', 'manager'] },
    { href: '/expenses?tab=suppliers', label: 'Suppliers Directory & Debt', icon: Truck, roles: ['admin', 'manager'] },
    { href: '/users', label: 'Users & Staff', icon: Users, roles: ['admin'] },
    { href: '/customers', label: 'Customers', icon: Users, roles: ['admin', 'manager', 'vendor_operator'] },
    { href: '/receipts', label: 'Receipts', icon: FileText, roles: ['admin', 'manager'] },
    { href: '/inventory/troubleshoot', label: 'AI Troubleshoot', icon: Bot, roles: ['admin', 'manager'] },
    { href: '/billing', label: 'Billing', icon: CreditCard, roles: ['admin'] },
    { href: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
];

export default function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
    const router = useRouter();
    const { products, currentUserProfile } = usePOS();
    const userRole = currentUserProfile?.role;

    const runCommand = React.useCallback((command: () => unknown) => {
        onOpenChange(false);
        command();
    }, [onOpenChange]);

    const visibleNavLinks = React.useMemo(() => {
        if (!userRole) return [];
        return navLinks.filter(link => link.roles.includes(userRole));
    }, [userRole]);

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Navigation">
                    {visibleNavLinks.map(link => (
                        <CommandItem key={link.href} value={link.label} onSelect={() => runCommand(() => router.push(link.href))}>
                           <link.icon className="mr-2 h-4 w-4" />
                           <span>{link.label}</span>
                        </CommandItem>
                    ))}
                </CommandGroup>
                {products && products.length > 0 && (
                    <>
                    <CommandSeparator />
                    <CommandGroup heading="Products">
                        {products.slice(0, 5).map(product => (
                            <CommandItem key={product.id} value={product.name} onSelect={() => runCommand(() => router.push(`/inventory/${product.id}`))}>
                                <Package className="mr-2 h-4 w-4" />
                                <span>{product.name}</span>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                    </>
                )}
            </CommandList>
        </CommandDialog>
    );
}
