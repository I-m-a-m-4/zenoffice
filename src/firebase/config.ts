export const firebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'zenoffice-bimex',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:630761261989:web:97bd9a5e2688dc20a8364c',
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCoFsriFYeN1JX0Nn3m7BTG37sLptHWYsQ',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'zenoffice-bimex.firebaseapp.com',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'zenoffice-bimex.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '630761261989',
};

