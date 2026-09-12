'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, query, where, getDocs, orderBy, getDoc, doc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { withFirestoreRetry, isOfflineError } from '@/firebase/retry';
import type { Branch } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface BranchContextType {
  activeBranchId: string;
  setActiveBranchId: (id: string) => void;
  branches: Branch[];
  isLoadingBranches: boolean;
  isMultiBranchEnabled: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [activeBranchId, setActiveBranchId] = useState<string>('all');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [impersonationTrigger, setImpersonationTrigger] = useState(0);
  const lastLoadedUserIdRef = React.useRef<string | null>(null);
  // Branches gate every other screen, and the effect below only re-runs when the
  // user changes. If the load dies because Firestore had not connected yet, it
  // would never be retried and the app would sit empty for the whole session -
  // so remember that and try again as soon as the network comes back.
  const loadFailedOfflineRef = React.useRef(false);
  const [connectivityRetry, setConnectivityRetry] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const retryIfStalled = () => {
      if (!loadFailedOfflineRef.current) return;
      loadFailedOfflineRef.current = false;
      setConnectivityRetry((n) => n + 1);
    };
    window.addEventListener('online', retryIfStalled);
    // 'online' does not fire when the machine was never flagged offline in the
    // first place - which is exactly the case here - so also poll slowly.
    const interval = setInterval(retryIfStalled, 15000);
    return () => {
      window.removeEventListener('online', retryIfStalled);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleImpersonationChange = () => {
      setImpersonationTrigger(prev => prev + 1);
    };
    window.addEventListener('zeneva_impersonation_change', handleImpersonationChange);
    
    const interval = setInterval(() => {
      const currentImpersonatedId = typeof window !== 'undefined' ? sessionStorage.getItem('zeneva_impersonated_user_id') : null;
      const targetUserId = currentImpersonatedId || (user?.uid || null);
      if (lastLoadedUserIdRef.current !== targetUserId) {
        setImpersonationTrigger(prev => prev + 1);
      }
    }, 1500);
    
    return () => {
      window.removeEventListener('zeneva_impersonation_change', handleImpersonationChange);
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    if (!user || !firestore) {
      setIsLoadingBranches(false);
      return;
    }

    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('zeneva_active_branch');
      if (cached) {
        setActiveBranchId(cached);
      }
      const cachedBranchesStr = localStorage.getItem('zeneva_cached_branches');
      if (cachedBranchesStr) {
        try {
          const cachedBranches = JSON.parse(cachedBranchesStr);
          if (cachedBranches && cachedBranches.length > 0) {
            setBranches(cachedBranches);
            setIsLoadingBranches(false); // Render cache immediately, validate in background
          }
        } catch (e) {
          console.error("Failed to parse cached branches", e);
        }
      }
    }

    const loadBranches = async () => {
      try {
        setIsLoadingBranches(true);
        const impersonatedId = typeof window !== 'undefined' ? sessionStorage.getItem('zeneva_impersonated_user_id') : null;
        const targetUserId = impersonatedId || user.uid;
        lastLoadedUserIdRef.current = targetUserId;

        // Try getting cached businessId first to avoid an extra DB read
        // Key the cache by user ID to prevent Admin's business ID from polluting normal user's state
        const cacheKey = `zeneva_cached_business_id_${targetUserId}`;
        let businessId = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
        
        if (!businessId || businessId === 'undefined' || businessId === 'null' || businessId === 'none') {
          const userDocRef = doc(firestore, 'users', targetUserId);
          const userDocSnap = await withFirestoreRetry(() => getDoc(userDocRef), {
            label: 'BranchProvider user profile',
          });
          if (userDocSnap.exists()) {
            businessId = userDocSnap.data().businessId;
          }
        }
        
        if (businessId) {
          if (typeof window !== 'undefined') {
            localStorage.setItem(cacheKey, businessId);
          }

          const branchesQuery = query(
            collection(firestore, 'branches'),
            where('businessId', '==', businessId),
            orderBy('createdAt', 'asc')
          );
          
          const businessDocRef = doc(firestore, 'businessInstances', businessId as string);

          // Fetch branches and business instance in parallel
          const [branchesSnap, businessDocSnap] = await Promise.all([
            withFirestoreRetry(() => getDocs(branchesQuery), {
              label: 'BranchProvider branches',
            }),
            withFirestoreRetry(() => getDoc(businessDocRef), {
              label: 'BranchProvider business instance',
            }).catch(err => {
              console.error("Failed to fetch business info for primary branch sync", err);
              return null;
            })
          ]);

          let fetchedBranches = branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Branch));
          
          // Ensure a primary branch exists with ID = businessId
          let correctPrimary = fetchedBranches.find(b => b.id === businessId && b.isPrimary);
          
          // Fetch the business instance info to get its name & address
          let businessName = 'Main Store (Primary)';
          let businessAddress = '';
          if (businessDocSnap && businessDocSnap.exists()) {
            businessName = businessDocSnap.data().name || businessName;
            businessAddress = businessDocSnap.data().address || '';
            if (typeof window !== 'undefined') {
              localStorage.setItem(`zeneva_cached_business_name_${targetUserId}`, businessName);
              localStorage.setItem(`zeneva_cached_business_address_${targetUserId}`, businessAddress);
            }
          }
            
            if (!correctPrimary) {
              try {
                // Write the correct primary branch with ID = businessId
                const { setDoc, serverTimestamp } = await import('firebase/firestore');
                const primaryBranchRef = doc(firestore, 'branches', businessId);
                const newBranch = {
                  businessId: businessId,
                  name: businessName,
                  address: businessAddress,
                  isPrimary: true,
                  isActive: true,
                  createdAt: serverTimestamp(),
                };

                await setDoc(primaryBranchRef, newBranch);
                const createdBranch = {
                  id: businessId,
                  businessId: businessId,
                  name: businessName,
                  address: businessAddress,
                  isPrimary: true,
                  isActive: true,
                  createdAt: new Date(),
                } as Branch;

                // Add to fetched branches and remove any old primary branches
                fetchedBranches = [createdBranch, ...fetchedBranches.filter(b => b.id !== businessId)];
              } catch (createErr) {
                console.error("Failed to write primary branch", createErr);
              }
            } else if (correctPrimary.name !== businessName || correctPrimary.address !== businessAddress) {
              try {
                const { updateDoc } = await import('firebase/firestore');
                const primaryBranchRef = doc(firestore, 'branches', businessId);
                await updateDoc(primaryBranchRef, {
                  name: businessName,
                  address: businessAddress
                });
                correctPrimary.name = businessName;
                correctPrimary.address = businessAddress;
              } catch (updateErr) {
                console.error("Failed to update primary branch name/address in sync with business", updateErr);
              }
            }

            // Clean up duplicates: if there are other primary branches (whose ID !== businessId), delete them!
            const duplicates = fetchedBranches.filter(b => b.isPrimary && b.id !== businessId);
            if (duplicates.length > 0) {
              try {
                const { deleteDoc } = await import('firebase/firestore');
                for (const dup of duplicates) {
                  await deleteDoc(doc(firestore, 'branches', dup.id));
                }
                fetchedBranches = fetchedBranches.filter(b => !duplicates.some(dup => dup.id === b.id));
              } catch (delErr) {
                console.error("Failed to delete duplicate primary branches", delErr);
              }
            }

            setBranches(fetchedBranches);
            if (typeof window !== 'undefined') {
              localStorage.setItem(`zeneva_cached_branches_${targetUserId}`, JSON.stringify(fetchedBranches));
            }
            
            if (fetchedBranches.length > 0 && activeBranchId !== 'all') {
               const isValid = fetchedBranches.find(b => b.id === activeBranchId);
               if (!isValid) {
                 setActiveBranchId('all');
               }
            }
          } else {
            setBranches([]);
          }
      } catch (err: any) {
        if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
          setBranches([]);
          // If a permission denied occurs, clear the user's cache so it can self-heal on the next mount
          if (typeof window !== 'undefined') {
            const targetUserId = lastLoadedUserIdRef.current;
            if (targetUserId) localStorage.removeItem(`zeneva_cached_business_id_${targetUserId}`);
          }
        } else {
          // Retries are already exhausted by this point. Flag it so the
          // connectivity watcher above re-runs the load instead of leaving the
          // user on an empty app until they restart it.
          if (isOfflineError(err)) {
            loadFailedOfflineRef.current = true;
            console.warn('Failed to load branches: Firestore unreachable. Will retry when the connection settles.', err);
          } else {
            console.error("Failed to load branches", err);
          }
          // Network or offline error: keep cached branches if they exist, or fall back to single primary branch
          if (typeof window !== 'undefined') {
            const cachedBusinessId = localStorage.getItem('zeneva_cached_business_id');
            const cachedBranchesStr = localStorage.getItem('zeneva_cached_branches');
            if (cachedBranchesStr) {
              try {
                const cachedBranches = JSON.parse(cachedBranchesStr);
                if (cachedBranches && cachedBranches.length > 0) {
                  setBranches(cachedBranches);
                  return;
                }
              } catch (parseErr) {}
            }
            if (cachedBusinessId) {
              const fallbackBranch = {
                id: cachedBusinessId,
                businessId: cachedBusinessId,
                name: localStorage.getItem('zeneva_cached_business_name') || 'Main Store (Primary)',
                address: localStorage.getItem('zeneva_cached_business_address') || '',
                isPrimary: true,
                isActive: true,
                createdAt: new Date(),
              } as Branch;
              setBranches([fallbackBranch]);
            }
          }
        }
      } finally {
        setIsLoadingBranches(false);
      }
    };

    loadBranches();
  }, [user, firestore, impersonationTrigger, connectivityRetry]);

  const handleSetActiveBranch = (id: string) => {
    setActiveBranchId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('zeneva_active_branch', id);
    }
  };

  const value = {
    activeBranchId,
    setActiveBranchId: handleSetActiveBranch,
    branches,
    isLoadingBranches,
    isMultiBranchEnabled: branches.length > 0
  };

  return (
    <BranchContext.Provider value={value}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
}
