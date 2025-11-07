import { getCurrentUser, onAuthStateChanged } from '@/services/auth.service';
import { AuthState, User } from '@/types';
import React, { createContext, useContext, useEffect, useState } from 'react';

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

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setAuthState('authenticated');
    } else {
      setAuthState('unauthenticated');
    }

    const unsubscribe = onAuthStateChanged((newUser: User | null) => {
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

