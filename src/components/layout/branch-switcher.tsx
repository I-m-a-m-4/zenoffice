'use client';

import React from 'react';
import { useBranch } from '@/context/branch-context';
import { usePOS } from '@/context/pos-context';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Store, Building2, ChevronDown, Plus, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { FeatureGateUpgradeCard } from '@/components/shared/feature-gate';
import { getCountryFromIP } from '@/lib/utils';

interface BranchSwitcherProps {
  variant?: 'sidebar' | 'header' | 'sheet';
  className?: string;
}

export function BranchSwitcher({ variant = 'sidebar', className }: BranchSwitcherProps) {
  const { activeBranchId, setActiveBranchId, branches, isLoadingBranches } = useBranch();
  const { currentUserProfile, business } = usePOS();
  const { state } = useSidebar();
  const router = useRouter();
  const [showProModal, setShowProModal] = React.useState(false);
  const [currency, setCurrency] = React.useState<'USD' | 'NGN'>('USD');
  const isCollapsed = variant === 'sidebar' && state === 'collapsed';

  React.useEffect(() => {
    if (showProModal) {
      getCountryFromIP().then((country) => {
        if (country === 'Nigeria') {
          setCurrency('NGN');
        } else {
          setCurrency('USD');
        }
      });
    }
  }, [showProModal]);

  const isOwner = currentUserProfile && (
    currentUserProfile.role === 'owner' ||
    business?.ownerId === currentUserProfile.id
  );

  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const hasMultipleBranches = branches.length > 1;
  const canShowName = branches.length > 0 || !!business?.name;

  if (!isMounted || (isLoadingBranches && !canShowName)) {
    if (variant === 'header') {
      return (
        <div className={cn("flex items-center", className)}>
          <Skeleton className="h-8 md:h-9 w-[130px] xs:w-[170px] sm:w-[220px] rounded-lg" />
        </div>
      );
    }
    if (variant === 'sheet') {
      return (
        <div className={cn("w-full py-1.5", className)}>
          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 tracking-wider px-1">Current Branch</p>
          <Skeleton className="w-full h-11 rounded-xl" />
        </div>
      );
    }
    return (
      <div className={cn("px-2 py-2 w-full", isCollapsed && "hidden", className)}>
        <Skeleton className="w-full h-9 rounded-md" />
      </div>
    );
  }

  const currentBranchName = (activeBranchId === 'all' && hasMultipleBranches)
    ? 'All Branches' 
    : branches.find(b => b.id === activeBranchId)?.name || business?.name || 'Main Store';

  const renderButtonContent = (iconClass: string, textClass: string) => (
    <div className="flex items-center gap-2 truncate">
      {activeBranchId === 'all' && hasMultipleBranches ? (
        <Building2 className={cn("shrink-0 text-primary", iconClass)} />
      ) : (
        <Store className={cn("shrink-0 text-primary", iconClass)} />
      )}
      <span className={cn("truncate", textClass)}>{currentBranchName}</span>
    </div>
  );

  const renderButton = (btnClass: string, iconClass: string, textClass: string, chevronClass: string) => {
    const btn = (
      <Button 
        variant={variant === 'header' ? 'ghost' : 'outline'} 
        disabled={!isOwner} 
        className={btnClass}
      >
        {renderButtonContent(iconClass, textClass)}
        <ChevronDown className={cn("opacity-50 shrink-0", chevronClass)} />
      </Button>
    );

    return (
      <>
        <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          {btn}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={variant === 'sheet' ? "w-[280px]" : "w-[200px]"}>
          {hasMultipleBranches && (
            <DropdownMenuItem onClick={() => setActiveBranchId('all')} className="font-semibold text-primary">
              All Branches
            </DropdownMenuItem>
          )}
          {branches.map(branch => (
            <DropdownMenuItem key={branch.id} onClick={() => setActiveBranchId(branch.id)}>
              {branch.name} {branch.isPrimary ? '(Primary)' : ''}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={(e) => {
              if (business?.plan === 'starter' || !business?.plan) {
                e.preventDefault();
                setShowProModal(true);
              } else {
                router.push('/settings/branches');
              }
            }}
            className="text-muted-foreground font-medium flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create branch
            </div>
            {(!business?.plan || business?.plan === 'starter') && (
              <div className="flex items-center gap-1 bg-muted text-muted-foreground text-[9px] uppercase px-1.5 py-0.5 rounded-sm font-bold">
                <Lock className="w-2.5 h-2.5" />
                Pro
              </div>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showProModal} onOpenChange={setShowProModal}>
        <DialogContent className="max-w-lg p-0 border-none bg-transparent shadow-none">
          <DialogTitle className="sr-only">Upgrade to Pro</DialogTitle>
          <FeatureGateUpgradeCard 
            featureName="Multi-Branch Management"
            featureDescription="Add and manage multiple store locations effortlessly. Keep inventory in sync across all your branches."
            requiredPlan="pro"
            icon={Store}
            currency={currency}
            featurePoints={[
              { title: "Centralized Control", description: "Manage all branches from a single dashboard." },
              { title: "Inventory Routing", description: "Transfer stock between different store locations." },
              { title: "Branch Analytics", description: "Track performance per location to see what's working." }
            ]}
            onUpgradeClick={() => setShowProModal(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
  };

  if (variant === 'header') {
    return (
      <div className={cn("flex items-center", className)}>
        {renderButton(
          "h-8 md:h-9 px-2 sm:px-2.5 bg-muted/40 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 border border-dashed border-primary/40 focus:ring-1 focus:ring-primary text-xs sm:text-sm font-semibold text-foreground rounded-lg max-w-[130px] xs:max-w-[170px] sm:max-w-[220px] transition-all shadow-2xs justify-between gap-1.5",
          "h-3.5 w-3.5",
          "",
          "h-3 w-3"
        )}
      </div>
    );
  }

  if (variant === 'sheet') {
    return (
      <div className={cn("w-full py-1.5", className)}>
        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 tracking-wider px-1">Current Branch</p>
        {renderButton(
          "w-full h-11 bg-muted/40 border-2 border-dashed border-primary/40 focus:ring-1 focus:ring-primary text-sm font-bold text-foreground rounded-xl px-3 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-all justify-between gap-2",
          "h-4 w-4",
          "",
          "h-4 w-4"
        )}
      </div>
    );
  }

  return (
    <div className={cn("px-2 py-2 w-full", isCollapsed && "hidden", className)}>
      {renderButton(
        "w-full h-9 bg-muted/30 border-dashed focus:ring-1 focus:ring-primary justify-between font-normal hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 gap-2",
        "h-4 w-4",
        "text-xs",
        "h-4 w-4"
      )}
    </div>
  );
}
