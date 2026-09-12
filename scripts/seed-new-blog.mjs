import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
};

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const post = {
  title: "Mastering Retail Operations with Zeneva",
  slug: "mastering-retail-operations-2026",
  excerpt: "Discover the five pillars of retail excellence. Learn how to scale your retail empire using Zeneva's tactical framework for multi-outlet success.",
  content: `Scaling a retail business in modern Nigeria requires more than just high-quality products. It requires a command over data, a shield against inventory loss, and the ability to manage multiple locations as if they were one.

In this guide, we break down the five pillars of operational excellence using the Zeneva framework.

## Tactical Inventory Management

Inventory is your business's lifeblood, but it is also where most capital is trapped. Zeneva's inventory system doesn't just track numbers; it tracks velocity.

- **Automated Reorder Points:** Set thresholds so you are notified before stockouts happen.
- **Expiry Tracking:** Crucial for pharmacies, Zeneva alerts you months in advance of batch expiration.

## Multi-Outlet Synchronization

The biggest challenge of growth is fragmentation. Zeneva brings every shop into a single, cohesive view.

## Real-Time Audit Integrity

Internal shrinkage is the silent killer of retail. Zeneva's audit logs record every single action taken on the system.

| Feature | Impact | Strategic Value |
|---------|--------|-----------------|
| **Void Records** | Prevent Fraud | High Integrity |
| **Price Logs** | Trace Changes | Margin Security |

## Customer Growth Framework

Acquiring a new customer is 5x more expensive than retaining an existing one. Use Zeneva's customer loyalty profiles to build high-fidelity relationships.`,
  imageUrl: "https://ik.imagekit.io/zeneva/blog/mastering-retail.jpg",
  authorName: "Zeneva Strategy Team",
  published: true,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

async function seed() {
  try {
    const docRef = await db.collection('blogPosts').add(post);
    console.log("Blog post seeded successfully with ID:", docRef.id);
    process.exit(0);
  } catch (err) {
    console.error("Error seeding blog post:", err);
    process.exit(1);
  }
}

seed();
