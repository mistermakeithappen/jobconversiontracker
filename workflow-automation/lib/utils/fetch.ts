/**
 * Wrapper around fetch that automatically includes credentials
 * This ensures cookies are sent with all API requests
 */
export async function fetchWithCredentials(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      ...init?.headers,
    },
  });
}