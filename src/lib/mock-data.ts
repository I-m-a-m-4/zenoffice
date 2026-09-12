import { placeholderImages } from './placeholder-images.json';

export type Product = {
  id: string;
  businessId: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  imageUrl?: string;
  imageHint?: string;
  description?: string;
};

export type Customer = {
  id: string;
  businessId: string;
  name: string;
  email: string;
  phone?: string;
};

export type CartItem = {
  product: Product;
  quantity: number;
}

export type Receipt = {
  id: string;
  businessId: string;
  items: { productId: string; name: string; quantity: number; price: number }[];
  customer?: Customer;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'Cash' | 'Card' | 'Bank Transfer';
  createdAt: Date;
};

const getImageUrl = (id: string) => placeholderImages.find(p => p.id === id)?.imageUrl;
const getImageHint = (id: string) => placeholderImages.find(p => p.id === id)?.imageHint;

export const mockProducts: Product[] = [
  { id: 'prod-001', businessId: 'biz-456', name: 'Quantum HD Monitor', sku: 'QHDM-001', category: 'Electronics', price: 349.99, stock: 25, imageUrl: getImageUrl('product-1'), imageHint: getImageHint('product-1'), description: 'A 27-inch 4K UHD monitor with HDR support.' },
  { id: 'prod-002', businessId: 'biz-456', name: 'Quantum HD Monitor', sku: 'QHDM-002-B', category: 'Electronics', price: 359.99, stock: 15, imageUrl: getImageUrl('product-1'), imageHint: getImageHint('product-1'), description: 'A 27-inch 4K UHD monitor with HDR support, black variant.' },
  { id: 'prod-003', businessId: 'biz-456', name: 'Mechanical Keyboard', sku: 'MK-BLUE-01', category: 'Accessories', price: 89.99, stock: 40, imageUrl: getImageUrl('product-2'), imageHint: getImageHint('product-2'), description: 'A full-sized mechanical keyboard with blue switches.' },
  { id: 'prod-004', businessId: 'biz-456', name: 'Ergonomic Mouse', sku: 'EM-2024', category: 'Accessories', price: 49.99, stock: 8, imageUrl: getImageUrl('product-3'), imageHint: getImageHint('product-3'), description: 'A comfortable ergonomic mouse for all-day use.' },
  { id: 'prod-005', businessId: 'biz-456', name: 'Zeneva Branded Hoodie', sku: 'ZBH-L-GRY', category: 'Apparel', price: 59.99, stock: 30, imageUrl: getImageUrl('product-4'), imageHint: getImageHint('product-4'), description: 'A comfortable gray hoodie with the Zeneva logo.' },
  { id: 'prod-006', businessId: 'biz-456', name: 'Zeneva Branded Hoodie', sku: 'ZBH-M-GRY', category: 'Apparel', price: 59.99, stock: 22, imageUrl: getImageUrl('product-4'), imageHint: getImageHint('product-4'), description: 'A comfortable gray hoodie with the Zeneva logo.' },
  { id: 'prod-007', businessId: 'biz-456', name: 'Smart Desk Lamp', sku: 'SDL-WHT-01', category: 'Home Goods', price: 79.00, stock: 18, imageUrl: getImageUrl('product-5'), imageHint: getImageHint('product-5'), description: 'A smart desk lamp with adjustable color temperature.' },
  { id: 'prod-008', businessId: 'biz-456', name: 'USB-C Hub', sku: 'UCHUB-8P', category: 'Accessories', price: 45.50, stock: 5, description: 'An 8-port USB-C hub with HDMI and Ethernet.' },
  { id: 'prod-009', businessId: 'biz-456', name: 'Coffee Mug', sku: 'MUG-ZNV', category: 'Office', price: 0, stock: 150, description: 'Zeneva branded coffee mug.' },
];

export const mockCustomers: Customer[] = [
  { id: 'cust-001', businessId: 'biz-456', name: 'John Doe', email: 'john.d@example.com', phone: '555-1234' },
  { id: 'cust-002', businessId: 'biz-456', name: 'Jane Smith', email: 'jane.s@example.com', phone: '555-5678' },
  { id: 'cust-003', businessId: 'biz-456', name: 'Peter Jones', email: 'peter.j@example.com', phone: '555-9012' },
];

export const mockReceipts: Receipt[] = [
  { id: 'rec-001', businessId: 'biz-456', items: [{ productId: 'prod-001', name: 'Quantum HD Monitor', quantity: 1, price: 349.99 }], customer: mockCustomers[0], subtotal: 349.99, tax: 29.75, discount: 0, total: 379.74, paymentMethod: 'Card', createdAt: new Date('2024-05-20T10:30:00Z') },
  { id: 'rec-002', businessId: 'biz-456', items: [{ productId: 'prod-003', name: 'Mechanical Keyboard', quantity: 2, price: 89.99 }], subtotal: 179.98, tax: 15.30, discount: 18.00, total: 177.28, paymentMethod: 'Cash', createdAt: new Date('2024-05-21T14:00:00Z') },
  { id: 'rec-003', businessId: 'biz-456', items: [{ productId: 'prod-005', name: 'Zeneva Branded Hoodie', quantity: 1, price: 59.99 }, { productId: 'prod-004', name: 'Ergonomic Mouse', quantity: 1, price: 49.99 }], customer: mockCustomers[1], subtotal: 109.98, tax: 9.35, discount: 0, total: 119.33, paymentMethod: 'Bank Transfer', createdAt: new Date('2024-05-22T09:15:00Z') }
];

export const mockUser = {
  userId: 'user-123',
  businessId: 'biz-456',
  name: 'Alex Doe',
  email: 'admin@zeneva.com',
  role: 'admin',
  avatarUrl: 'https://i.pravatar.cc/150?u=alexdoe',
};

export const mockBusiness = {
  businessId: 'biz-456',
  name: 'Zeneva Demo Store',
  address: '123 Main St, Anytown, USA',
  bankName: 'Demo Bank',
  bankAccountNumber: '1234567890',
  subscription: 'premium',
  taxRate: 8.5
};
