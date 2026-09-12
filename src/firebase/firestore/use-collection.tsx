'use client';

import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
  mutate: Dispatch<SetStateAction<WithId<T>[] | null>>; // Function to manually update data
}

/* Internal implementation of Query:
  https://github.com/firebase/firebase-js-sdk/blob/c5f08a9bc5da0d2b0207802c972d53724ccef055/packages/firestore/src/lite-api/reference.ts#L143
*/
export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

/**
 * React hook to fetch a Firestore collection or query once.
 * This has been optimized to use a one-time 'get' request instead of a real-time listener
 * to reduce database reads and costs. Data can be refreshed using the global Refresh button.
 *
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *  
 * @template T Optional type for document data. Defaults to any.
 * @param {CollectionReference<DocumentData> | Query<DocumentData> | null | undefined} targetRefOrQuery -
 * The Firestore CollectionReference or Query. Waits if null/undefined.
 * @returns {UseCollectionResult<T>} Object with data, isLoading, error.
 */
export function useCollection<T = any>(
  memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & { __memo?: boolean }) | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = () => {
      if (!memoizedTargetRefOrQuery) {
        if (isMounted) {
          setData(null);
          setIsLoading(false);
          setError(null);
        }
        return;
      }

      if (isMounted && !data) {
        setIsLoading(true);
      }
      setError(null);

      const unsubscribe = onSnapshot(memoizedTargetRefOrQuery, (snapshot) => {
        if (isMounted) {
          const results: WithId<T>[] = snapshot.docs.map((doc) => ({
            ...(doc.data() as T),
            id: doc.id,
          }));
          setData(results);
          setIsLoading(false);
        }
      }, (error: any) => {
        if (!isMounted) return;

        if (error.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: (memoizedTargetRefOrQuery as InternalQuery)?._query?.path?.toString(),
            operation: 'list',
          });
          errorEmitter.emit('permission-error', permissionError);
          setError(permissionError);
        } else {
          console.error('useCollection error:', error);
          setError(error);
        }
        setData(null);
        setIsLoading(false);
      });

      return unsubscribe;
    };

    const unsubscribe = fetchData();

    return () => {
      isMounted = false;
      if (!unsubscribe) return;
      // The SDK can throw "INTERNAL ASSERTION FAILED: Unexpected state" out of
      // unsubscribe when a listener is detached while its Listen stream still
      // has in-flight target changes. Letting that escape a cleanup function
      // turns a recoverable teardown race into an unhandled crash.
      try {
        unsubscribe();
      } catch (err) {
        console.warn('useCollection: listener teardown threw, ignoring.', err);
      }
    };
  }, [memoizedTargetRefOrQuery]);

  if (memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error(memoizedTargetRefOrQuery + ' was not properly memoized using useMemoFirebase');
  }
  return { data, isLoading, error, mutate: setData };
}
