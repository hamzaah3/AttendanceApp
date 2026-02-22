import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { subscribeAuth, signIn as firebaseSignIn, signOut as firebaseSignOut, registerWithEmail, resetPassword } from '@/lib/firebase';
import { getUserByFirebaseUid, createOrUpdateUser } from '@/services/data';
import type { User } from '@/types';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  dbUser: User | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ firebaseUser: null, dbUser: null, loading: true });

  const refreshUser = useCallback(async () => {
    const uid = state.firebaseUser?.uid;
    if (!uid) return;
    const dbUser = await getUserByFirebaseUid(uid);
    setState((s) => ({ ...s, dbUser }));
  }, [state.firebaseUser?.uid]);

  useEffect(() => {
    const unsub = subscribeAuth(async (firebaseUser) => {
      if (!firebaseUser) {
        setState({ firebaseUser: null, dbUser: null, loading: false });
        return;
      }
      let dbUser = await getUserByFirebaseUid(firebaseUser.uid);
      if (!dbUser) {
        dbUser = await createOrUpdateUser({
          firebaseUid: firebaseUser.uid,
          name: firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'User',
          email: firebaseUser.email ?? '',
          committedHoursPerDay: 8,
          weeklyOffDays: ['Saturday', 'Sunday'],
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      }
      setState({ firebaseUser, dbUser, loading: false });
    });
    return () => unsub();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await firebaseSignIn(email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const cred = await registerWithEmail(email, password);
    await createOrUpdateUser({
      firebaseUid: cred.user.uid,
      name,
      email: cred.user.email ?? email,
      committedHoursPerDay: 8,
      weeklyOffDays: ['Saturday', 'Sunday'],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut();
    setState({ firebaseUser: null, dbUser: null, loading: false });
  }, []);

  const handleResetPassword = useCallback(async (email: string) => {
    await resetPassword(email);
  }, []);

  const value: AuthContextValue = {
    ...state,
    signIn,
    signUp,
    signOut,
    resetPassword: handleResetPassword,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
