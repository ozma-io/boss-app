import { auth } from '@/constants/firebase.config';
import { getCurrentUser, onAuthStateChanged, verifyEmailCode } from '@/services/auth.service';
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

function tryOpenInExpoGo(magicLinkUrl: string, email: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  // Check if we're on mobile browser
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Get the current host (e.g., "192.168.1.74:8081")
    const host = window.location.host;
    
    // Encode the magic link URL to pass it to Expo Go
    const encodedLink = encodeURIComponent(magicLinkUrl);
    const encodedEmail = encodeURIComponent(email);
    
    // Construct Expo Go deep link with magic link parameters
    const expoGoUrl = `exp://${host}/--/(auth)/email-confirm?magicLink=${encodedLink}&email=${encodedEmail}`;
    
    console.log('[AuthContext] Redirecting to Expo Go with magic link');
    
    // Redirect to Expo Go (don't authenticate in web)
    window.location.href = expoGoUrl;
    
    // Show message to user
    setTimeout(() => {
      const message = document.createElement('div');
      message.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 24px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        text-align: center;
        max-width: 80%;
      `;
      message.innerHTML = `
        <h3 style="margin: 0 0 12px 0;">Opening Expo Go...</h3>
        <p style="margin: 0 0 16px 0;">If Expo Go didn't open automatically, click the button below.</p>
        <button onclick="window.location.href='${expoGoUrl}'" style="
          background: #000;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
        ">Open Expo Go</button>
      `;
      document.body.appendChild(message);
    }, 500);
  }
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
            // Check if we're on mobile browser - redirect to Expo Go instead of authenticating
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            
            if (isMobile) {
              console.log('[AuthContext] Mobile browser detected, redirecting to Expo Go with magic link');
              tryOpenInExpoGo(url, email);
              return; // Don't authenticate in web, let Expo Go handle it
            }
            
            // Desktop web: authenticate normally
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
      setUser(newUser);
      setAuthState(newUser ? 'authenticated' : 'unauthenticated');
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

