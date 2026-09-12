
'use client';
import {
  doc,
  setDoc,
  serverTimestamp,
  type Firestore,
  writeBatch,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  increment,
  addDoc,
  getDoc,
  runTransaction,
  updateDoc,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { UserProfile, UserRole, BusinessInstance } from '@/types';


/**
 * Creates a user profile document in Firestore, ensuring atomicity for signup.
 * This is the single source of truth for creating a new user and their associated business.
 * It's designed to be called only once upon successful user creation in Firebase Auth.
 */
export const createUserProfileDocument = async (
  firestore: Firestore,
  user: User,
  displayName: string,
  phone?: string,
  invitationCode?: string | null
) => {
  const userDocRef = doc(firestore, `users/${user.uid}`);

  try {
    const batch = writeBatch(firestore);
      
    let businessId: string;
    let userRole: UserRole;
    let branchId: string | undefined;
    let surveyCompleted = true; // Default for invited users

    if (invitationCode) {
      const invDocRef = doc(firestore, 'invitations', invitationCode);
      const invDocSnap = await getDoc(invDocRef);

      if (!invDocSnap.exists()) {
        throw new Error("This invitation is invalid or has already been used.");
      }
      
      const invitationData = invDocSnap.data();

      if (invitationData.email.toLowerCase() !== user.email?.toLowerCase()) {
        throw new Error("This invitation is for a different email address.");
      }

      businessId = invitationData.businessId;
      userRole = invitationData.role;
      branchId = invitationData.branchId;
      batch.delete(invDocRef);
    } else {
      const invitationQuery = query(collection(firestore, 'invitations'), where('email', '==', user.email));
      const invitationSnapshot = await getDocs(invitationQuery);
      if (!invitationSnapshot.empty) {
          throw new Error("You have a pending invitation. Please use the link in your invitation email to sign up.");
      }

      const businessDocRef = doc(collection(firestore, 'businessInstances'));
      businessId = businessDocRef.id;
      userRole = 'admin';
      surveyCompleted = false;
      // No trial date. Starter is free forever, so a countdown here would be a
      // lie — and it used to be read as a lockout deadline. `trialExpiresAt` is
      // now written only by the billing flow, for real paying customers.
      let localTimezone = 'Africa/Lagos';
      try {
          localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos';
      } catch (e) {
          console.warn("Could not determine local timezone, defaulting to Africa/Lagos");
      }

      const newBusiness: Omit<BusinessInstance, 'id'> = {
        name: displayName,
        createdAt: serverTimestamp(),
        ownerId: user.uid,
        plan: 'starter',
        status: 'active',
        settings: { currency: 'NGN', timezone: localTimezone, defaultTaxRate: 0, productCategories: [] }
      };
      batch.set(businessDocRef, newBusiness);
    }

    const userProfile: Omit<UserProfile, 'id'> = {
      email: user.email!,
      name: displayName,
      phone: phone || '',
      createdAt: serverTimestamp(),
      businessId: businessId,
      role: userRole,
      surveyCompleted: surveyCompleted,
      status: 'active',
      // Record how this user signed up so the admin can filter/segment by auth method.
      authProvider: user.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'email',
    };

    if (branchId) {
      userProfile.branchId = branchId;
    }
    // Recorded so firestore.rules can verify this member was actually invited to
    // `businessId`, rather than taking the claim on trust. The invitation is
    // deleted in this same batch, but rules evaluate `get()` against the
    // pre-batch state, so the document is still there to check against.
    if (invitationCode) {
      userProfile.invitationCode = invitationCode;
    }
    batch.set(userDocRef, userProfile);

    await batch.commit();

  } catch (error) {
    console.error("FATAL: User creation transaction failed.", error);
    // If Firestore fails, we should delete the auth user to prevent orphaned accounts.
    await user.delete().catch(deleteError => {
        console.error("FATAL: Failed to clean up orphaned auth user.", deleteError);
    });
    throw error;
  }
};

/**
 * Polls Firestore until the user's profile document is available.
 * This is used after signup to prevent a race condition where the app
 * tries to read the profile before it has been created.
 */
export const waitForUserProfile = (firestore: Firestore, userId: string, timeout = 5000): Promise<void> => {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      const userDocRef = doc(firestore, `users/${userId}`);
      try {
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error("Timed out waiting for user profile creation."));
        } else {
          setTimeout(check, 300); // Poll every 300ms
        }
      } catch (error) {
         console.error("Polling for user profile failed:", error);
         // Keep polling unless we time out
         if (Date.now() - startTime > timeout) {
           reject(error);
         } else {
           setTimeout(check, 300);
         }
      }
    };
    check();
  });
};
