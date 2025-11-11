import { auth } from '@/constants/firebase.config';
import { resetAmplitudeUser, setAmplitudeUserId } from '@/services/amplitude.service';
import { clearAttributionData, getAttributionData } from '@/services/attribution.service';
import { getCurrentUser, onAuthStateChanged, verifyEmailCode } from '@/services/auth.service';
import { logoutIntercomUser, registerIntercomUser } from '@/services/intercom.service';
import { updateUserAttribution } from '@/services/user.service';
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
        // Link attribution data to user if available
        getAttributionData()
          .then(async (attributionData) => {
            if (attributionData) {
              console.log('[AuthContext] Linking attribution data to user:', newUser.id);
              try {
                await updateUserAttribution(newUser.id, attributionData);
                // Clear attribution data after successfully linking to user
                await clearAttributionData();
                console.log('[AuthContext] Attribution data linked and cleared from storage');
              } catch (error) {
                console.error('[AuthContext] Error linking attribution data:', error);
              }
            }
          })
          .catch(err => console.error('[AuthContext] Error getting attribution data:', err));
        
        // Set Amplitude user ID
        setAmplitudeUserId(newUser.id)
          .catch(err => console.error('Amplitude setUserId failed:', err));
        
        registerIntercomUser(newUser.id, newUser.email, undefined)
          .catch(err => console.error('Intercom registration failed:', err));
      } else {
        // Reset Amplitude user on logout
        resetAmplitudeUser()
          .catch(err => console.error('Amplitude reset failed:', err));
        
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

