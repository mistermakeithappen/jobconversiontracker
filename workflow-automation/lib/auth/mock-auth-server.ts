// Server-side mock auth for API routes and server components
// This file is NOT a client component

export const MOCK_USER_ID = 'af8ba507-b380-4da8-a1e2-23adee7497d5';

export function mockAuthServer() {
  return {
    userId: MOCK_USER_ID,
    user: {
      id: MOCK_USER_ID,
      email: 'dev@example.com',
      name: 'Dev User',
    },
  };
}