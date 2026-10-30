import { QueryClient } from '@tanstack/react-query';

/** The app's one query cache; signing out clears it so the next user starts empty */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
