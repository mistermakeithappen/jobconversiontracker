'use client';

import { createContext, useContext, ReactNode } from 'react';

interface MockUser {
  id: string;
  email: string;
  name: string;
}

interface MockAuthContextType {
  user: MockUser | null;
  userId: string | null;
  isLoaded: boolean;
  isSignedIn: boolean;
}

const MockAuthContext = createContext<MockAuthContextType>({
  user: null,
  userId: null,
  isLoaded: true,
  isSignedIn: false,
});

// Mock user for development
const MOCK_USER: MockUser = {
  id: 'af8ba507-b380-4da8-a1e2-23adee7497d5',
  email: 'dev@example.com',
  name: 'Dev User',
};

export function MockAuthProvider({ children }: { children: ReactNode }) {
  // For development, always return a signed-in user
  const value: MockAuthContextType = {
    user: MOCK_USER,
    userId: MOCK_USER.id,
    isLoaded: true,
    isSignedIn: true,
  };

  return (
    <MockAuthContext.Provider value={value}>
      {children}
    </MockAuthContext.Provider>
  );
}

export function useMockAuth() {
  return useContext(MockAuthContext);
}

