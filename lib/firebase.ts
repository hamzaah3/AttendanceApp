import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  // @ts-ignore
  getReactNativePersistence,
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User as FirebaseUser,
  UserCredential,
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  if (auth) return auth;
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) return null;
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  }
  auth = initializeAuth(app!, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
  return auth;
}

export async function registerWithEmail(email: string, password: string): Promise<UserCredential> {
  const a = getFirebaseAuth();
  if (!a) throw new Error('Firebase not configured');
  return createUserWithEmailAndPassword(a, email, password);
}

export async function signIn(email: string, password: string): Promise<UserCredential> {
  const a = getFirebaseAuth();
  if (!a) throw new Error('Firebase not configured');
  return signInWithEmailAndPassword(a, email, password);
}

export async function signOut(): Promise<void> {
  const a = getFirebaseAuth();
  if (a) await firebaseSignOut(a);
}

export async function resetPassword(email: string): Promise<void> {
  const a = getFirebaseAuth();
  if (!a) throw new Error('Firebase not configured');
  await sendPasswordResetEmail(a, email);
}

export function subscribeAuth(callback: (user: FirebaseUser | null) => void): () => void {
  const a = getFirebaseAuth();
  if (!a) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(a, callback);
}
