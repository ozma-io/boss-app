import { auth } from '@/constants/firebase.config';
import { getCurrentUser, onAuthStateChanged, verifyEmailCode } from '@/services/auth.service';
import { logoutIntercomUser, registerIntercomUser } from '@/services/intercom.service';
import { AuthState, User } from '@/types';
import { isSignInWithEmailLink } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

interface AuthContextType {
  user: User | null;
  authState: AuthState;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<AuthState>('loading');
  const isProcessingEmailLinkRef = useRef<boolean>(false);

  useEffect(() => {
    const initAuth = async (): Promise<void> => {
      if (Platform.OS === 'web') {
        const url = window.location.href;
        
        if (isSignInWithEmailLink(auth, url)) {
          let email = window.localStorage.getItem('emailForSignIn');
          
          if (!email) {
            const urlParams = new URLSearchParams(window.location.search);
            email = urlParams.get('email');
          }
          
          if (email) {
            // Authenticate with email link
            isProcessingEmailLinkRef.current = true;
            try {
              const signedInUser = await verifyEmailCode(email, url);
              setUser(signedInUser);
              setAuthState('authenticated');
              window.localStorage.removeItem('emailForSignIn');
              window.history.replaceState({}, document.title, window.location.pathname);
              isProcessingEmailLinkRef.current = false;
              return;
            } catch (error) {
              console.error('Error signing in with email link:', error);
              isProcessingEmailLinkRef.current = false;
            }
          }
        }
      }
      
      const currentUser = getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setAuthState('authenticated');
      } else {
        setAuthState('unauthenticated');
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged((newUser: User | null) => {
      if (isProcessingEmailLinkRef.current) {
        return;
      }
      console.log(`🔐 [AuthContext] Auth state changed: ${newUser ? 'authenticated' : 'unauthenticated'} at ${new Date().toISOString()}`);
      setUser(newUser);
      setAuthState(newUser ? 'authenticated' : 'unauthenticated');
      
      if (newUser) {
        registerIntercomUser(newUser.id, newUser.email, undefined)
          .catch(err => console.error('Intercom registration failed:', err));
      } else {
        logoutIntercomUser()
          .catch(err => console.error('Intercom logout failed:', err));
      }
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, authState, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

