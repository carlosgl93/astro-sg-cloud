import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, type Functions } from 'firebase/functions';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
  measurementId: import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Validate required configuration
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key as keyof typeof firebaseConfig]);

if (missingKeys.length > 0) {
  console.warn(
    `Firebase configuration is incomplete. Missing: ${missingKeys.join(', ')}. ` +
      'Please ensure all required environment variables are set in your .env file.'
  );
}

// Initialize Firebase (singleton pattern)
let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let functions: Functions | undefined;

/**
 * Get or initialize the Firebase app instance
 */
export const getFirebaseApp = (): FirebaseApp | undefined => {
  if (missingKeys.length > 0) {
    console.warn('Cannot initialize Firebase: Missing configuration');
    return undefined;
  }

  if (!app) {
    // Check if an app already exists
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
    } else {
      app = initializeApp(firebaseConfig);
    }
  }
  return app;
};

/**
 * Get Firestore database instance
 */
export const getFirestoreDb = (): Firestore | undefined => {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return undefined;

  if (!db) {
    db = getFirestore(firebaseApp);
  }
  return db;
};

/**
 * Get Firebase Storage instance
 */
export const getFirebaseStorage = (): FirebaseStorage | undefined => {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return undefined;

  if (!storage) {
    storage = getStorage(firebaseApp);
  }
  return storage;
};

/**
 * Get Firebase Functions instance
 */
export const getFirebaseFunctions = (): Functions | undefined => {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return undefined;

  if (!functions) {
    functions = getFunctions(firebaseApp);
  }
  return functions;
};

// Export for direct use
export { app, db, storage, functions };

// Helper to check if Firebase is configured
export const isFirebaseConfigured = (): boolean => {
  return missingKeys.length === 0;
};
