
"use client";

import React, { useEffect, useState } from 'react';
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingCart, ListChecks, UserPlus, Loader2 } from "lucide-react";
import type { Customer, Receipt, UserProfile } from "@/types";
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where, getDocs, doc, orderBy, limit } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';

type ActivityItem =
  | { type: 'sale', data: Receipt, timestamp: Date }
  | { type: 'new_customer', data: Customer, timestamp: Date };

// This hook now returns the loading state along with the business ID.
function useCurrentBusinessId() {
  const { user, isUserLoading } = useUser(); // <-- Get the user loading state
  const firestore = useFirestore();
  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  return {
    businessId: userProfile?.businessId ?? null,
    isLoading: isUserLoading || isProfileLoading, // Combine loading states
  };
}

export default function RecentActivity() {
  const { businessId: currentBusinessId, isLoading: isBusinessIdLoading } = useCurrentBusinessId();
  const firestore = useFirestore();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Abort if the business ID is loading or not available.
    if (isBusinessIdLoading || !currentBusinessId || !firestore) {
      // If we're not loading the business ID anymore (e.g., user logged out),
      // ensure the local loading state is also false.
      if (!isBusinessIdLoading) {
        if (isMounted) {
          setIsLoading(false);
          setActivities([]); // Clear activities on logout
        }
      }
      return;
    }

    const fetchActivities = async () => {
      if (isMounted) setIsLoading(true);
      try {
        const salesQuery = query(
          collection(firestore, "receipts"),
          where("businessId", "==", currentBusinessId),
          orderBy("createdAt", "desc"),
          limit(10)
        );

        const customersQuery = query(
          collection(firestore, "customers"),
          where("businessId", "==", currentBusinessId),
          orderBy("createdAt", "desc"),
          limit(10)
        );

        const [salesSnapshot, customersSnapshot] = await Promise.all([
          getDocs(salesQuery),
          getDocs(customersQuery)
        ]);

        if (isMounted) {
          const salesActivities: ActivityItem[] = salesSnapshot.docs.map(doc => {
            const data = doc.data() as Receipt;
            const timestamp = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
            return { type: 'sale', data: { ...data, id: doc.id }, timestamp };
          });

          const customerActivities: ActivityItem[] = customersSnapshot.docs.map(doc => {
            const data = doc.data() as Customer;
            const timestamp = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
            return { type: 'new_customer', data: { ...data, id: doc.id }, timestamp };
          });

          const combined = [...salesActivities, ...customerActivities];
          combined.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

          setActivities(combined.slice(0, 15));
        }

      } catch (error) {
        if (isMounted) {
          console.error("Error fetching recent activities:", error);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchActivities();

    return () => {
      isMounted = false;
    };
  }, [currentBusinessId, firestore, isBusinessIdLoading]);


  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest sales and customer sign-ups.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[370px] pr-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : activities.length > 0 ? (
            <ul className="space-y-4">
              {activities.map((activity) => (
                <li key={`${activity.type}-${activity.data.id}`} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-shrink-0 mt-1">
                    {activity.type === 'sale' && <ShoppingCart className="h-5 w-5 text-green-500" />}
                    {activity.type === 'new_customer' && <UserPlus className="h-5 w-5 text-blue-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {activity.type === 'sale' ? `New Sale: #${activity.data.id.substring(0, 7)}` : `New Customer: ${activity.data.name}`}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {activity.type === 'sale' ? `Total: ₦${activity.data.total.toLocaleString()}` : activity.data.email}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(activity.timestamp, { addSuffix: true })}</p>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={activity.type === 'sale' ? `/receipts/${activity.data.id}` : `/customers`}>View</Link>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
              <ListChecks className="h-16 w-16 opacity-50 mb-4" />
              <p className="text-lg font-medium">No Recent Activity</p>
              <p className="text-sm">New sales and customers will appear here.</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
