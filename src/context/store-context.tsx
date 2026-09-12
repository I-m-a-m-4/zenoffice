'use client';
import { createContext, useContext, useState, ReactNode, useEffect, useMemo, useCallback } from 'react';
import type { Customer, Product, CartItem, BusinessInstance, Receipt, UserProfile, OnlineOrder } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, getDocs, limit, or, getDoc, and } from 'firebase/firestore';
import { useParams } from 'next/navigation';
import { secureStorage } from '@/lib/secure-storage';

interface StoreContextType {
  business: BusinessInstance | null;
  products: Product[] | null;
  isLoading: boolean;
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  onOrderPlaced: () => void;
  searchProducts: (term: string) => Promise<Product[]>;
  subtotal: number;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'zeneva-store-cart';

export function StoreProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const params = useParams();
  const businessIdOrSlug = params.businessId as string;

  const [business, setBusiness] = useState<BusinessInstance | null>(null);
  const [businessLoading, setBusinessLoading] = useState(true);
  
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    // Load cart from secureStorage on initial render
    const storedCart = secureStorage.getItem<CartItem[]>(CART_STORAGE_KEY);
    if (storedCart) {
        setCart(storedCart);
    }
  }, []);

  useEffect(() => {
    // Save cart to secureStorage whenever it changes
    secureStorage.setItem(CART_STORAGE_KEY, cart);
  }, [cart]);


  useEffect(() => {
    if (!firestore || !businessIdOrSlug) {
        setBusinessLoading(false);
        return;
    }

    const findBusiness = async () => {
        setBusinessLoading(true);
        try {
            let foundBusiness: BusinessInstance | null = null;
            const businessCollection = collection(firestore, 'businessInstances');
            
            const q = query(businessCollection, where('settings.publicStore.slug', '==', businessIdOrSlug), limit(1));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const businessDoc = querySnapshot.docs[0];
                const businessData = { id: businessDoc.id, ...businessDoc.data() } as BusinessInstance;
                if (businessData.settings?.publicStore?.enabled) {
                    foundBusiness = businessData;
                }
            } else {
                const docRef = doc(firestore, 'businessInstances', businessIdOrSlug);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const businessData = { id: docSnap.id, ...docSnap.data() } as BusinessInstance;
                    if (businessData.settings?.publicStore?.enabled) {
                       foundBusiness = businessData;
                   }
                }
            }
            setBusiness(foundBusiness);
        } catch (error) {
            console.error("Error finding business:", error);
        } finally {
            setBusinessLoading(false);
        }
    };

    findBusiness();
  }, [firestore, businessIdOrSlug]);

  const productsQuery = useMemoFirebase(() => (business?.id ? query(collection(firestore, "products"), where("businessId", "==", business.id), limit(24)) : null), [business?.id, firestore]);
  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);

  const searchProducts = useCallback(async (term: string) => {
    if (!business?.id || !term.trim()) return [];
    try {
        const q = query(
            collection(firestore, "products"),
            and(
                where("businessId", "==", business.id),
                or(
                    where("name", ">=", term),
                    where("name", "<=", term + '\uf8ff')
                )
            ),
            limit(24)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ ...d.data(), id: d.id } as Product));
    } catch (e) {
        console.error("Store search failed:", e);
        return [];
    }
  }, [business?.id, firestore]);

  const isLoading = businessLoading || isLoadingProducts;

  const addToCart = (product: Product) => {
    setCart(prevCart => {
        const existingItem = prevCart.find(item => item.product.id === product.id);
        if (existingItem) {
            if (existingItem.quantity >= (product.stock || 0)) {
                toast({ title: 'Stock limit reached', variant: 'warning' });
                return prevCart;
            }
            return prevCart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
        }
        if ((product.stock || 0) <= 0) {
            toast({ title: 'Out of stock', variant: 'destructive' });
            return prevCart;
        }
        return [...prevCart, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };
  
  const updateQuantity = (productId: string, quantity: number) => {
    const itemInCart = cart.find(item => item.product.id === productId);
    if (!itemInCart) return;

    if (quantity > (itemInCart.product.stock || 0)) {
        toast({ title: 'Stock limit reached', variant: 'destructive' });
        quantity = itemInCart.product.stock || 0;
    }
    
    if (quantity <= 0) {
        removeFromCart(productId);
    } else {
        setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity } : item));
    }
  };

  const clearCart = () => setCart([]);
  const onOrderPlaced = () => clearCart();

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0), [cart]);

  const value = useMemo(() => ({
    business,
    products,
    isLoading,
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    onOrderPlaced,
    searchProducts,
    subtotal
  }), [business, products, isLoading, cart, searchProducts, subtotal]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
