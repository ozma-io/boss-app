import { auth } from '@/constants/firebase.config';
import { resetAmplitudeUser, setAmplitudeUserId } from '@/services/amplitude.service';
import { getAttributionData } from '@/services/attribution.service';
import { onAuthStateChanged, verifyEmailCode } from '@/services/auth.service';
import { logoutIntercomUser } from '@/services/intercom.service';
import { logger } from '@/services/logger.service';
import { ensureUserProfileExists, updateUserAttribution } from '@/services/user.service';
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
  const hasReceivedInitialAuthStateRef = useRef<boolean>(false);

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
              hasReceivedInitialAuthStateRef.current = true;
              window.localStorage.removeItem('emailForSignIn');
              window.history.replaceState({}, document.title, window.location.pathname);
              isProcessingEmailLinkRef.current = false;
              return;
            } catch (error) {
              logger.error('Error signing in with email link', { feature: 'AuthContext', error });
              isProcessingEmailLinkRef.current = false;
            }
          }
        }
      }
      
      // Don't set auth state here - wait for onAuthStateChanged to fire
      // This prevents the flash of login screen when Firebase Auth is still initializing
    };

    initAuth();

    const unsubscribe = onAuthStateChanged((newUser: User | null) => {
      if (isProcessingEmailLinkRef.current) {
        return;
      }
      
      // This is the first auth state change event from Firebase Auth
      // It's guaranteed to fire after Firebase has fully initialized and checked for existing session
      if (!hasReceivedInitialAuthStateRef.current) {
        hasReceivedInitialAuthStateRef.current = true;
        logger.info(`Initial auth state received: ${newUser ? 'authenticated' : 'unauthenticated'}`, { 
          feature: 'AuthContext', 
          hasUser: !!newUser 
        });
      } else {
        logger.info(`Auth state changed: ${newUser ? 'authenticated' : 'unauthenticated'}`, { 
          feature: 'AuthContext', 
          hasUser: !!newUser 
        });
      }
      
      setUser(newUser);
      setAuthState(newUser ? 'authenticated' : 'unauthenticated');
      
      if (newUser) {
        // Ensure user profile document exists with correct email
        // Add detailed logging for diagnostics of permission-denied errors
        (async () => {
          try {
            // Check if Firebase Auth token is available before calling Firestore
            const tokenCheckStartTime = Date.now();
            let tokenInfo: {
              hasToken: boolean;
              tokenLength?: number;
              tokenPreview?: string | null;
              tokenError?: string;
              tokenCheckDuration: number;
            } = {
              hasToken: false,
              tokenCheckDuration: 0,
            };
            
            try {
              const token = await auth.currentUser?.getIdToken(false); // false = don't force refresh, use cache
              tokenInfo = {
                hasToken: !!token,
                tokenLength: token?.length,
                tokenPreview: token ? `${token.substring(0, 20)}...${token.substring(token.length - 10)}` : null,
                tokenCheckDuration: Date.now() - tokenCheckStartTime,
              };
              
              logger.debug('Auth token check before ensureUserProfileExists', {
                feature: 'AuthContext',
                userId: newUser.id,
                ...tokenInfo,
              });
            } catch (tokenError) {
              tokenInfo = {
                hasToken: false,
                tokenError: tokenError instanceof Error ? tokenError.message : String(tokenError),
                tokenCheckDuration: Date.now() - tokenCheckStartTime,
              };
              
              logger.warn('Failed to get auth token before ensureUserProfileExists', {
                feature: 'AuthContext',
                userId: newUser.id,
                ...tokenInfo,
              });
            }
            
            await ensureUserProfileExists(newUser.id, newUser.email);
          } catch (err) {
            logger.error('Failed to ensure user profile exists', { 
              feature: 'AuthContext', 
              error: err,
              userId: newUser.id,
              userEmail: newUser.email,
            });
          }
        })();
        
        // Link attribution data to user if available
        getAttributionData()
          .then(async (attributionData) => {
            if (attributionData) {
              logger.info('Linking attribution data to user', { feature: 'AuthContext', userId: newUser.id });
              try {
                await updateUserAttribution(newUser.id, attributionData);
                // Keep attribution data in AsyncStorage for future App Launch events
                logger.info('Attribution data linked to user (kept in storage)', { feature: 'AuthContext' });
              } catch (error) {
                logger.error('Error linking attribution data', { feature: 'AuthContext', error });
              }
            }
          })
          .catch(err => logger.error('Error getting attribution data', { feature: 'AuthContext', error: err }));
        
        // Set Amplitude user ID
        setAmplitudeUserId(newUser.id)
          .catch(err => logger.error('Amplitude setUserId failed', { feature: 'AuthContext', error: err }));
        
        // Note: Intercom user registration moved to lazy loading (when user opens Support)
        // This prevents background timeout issues on iOS
      } else {
        // Reset Amplitude user on logout
        resetAmplitudeUser()
          .catch(err => logger.error('Amplitude reset failed', { feature: 'AuthContext', error: err }));
        
        logoutIntercomUser()
          .catch(err => logger.error('Intercom logout failed', { feature: 'AuthContext', error: err }));
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

