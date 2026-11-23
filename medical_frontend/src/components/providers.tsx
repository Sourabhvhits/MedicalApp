'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ApiError, getOne, setSessionExpiredHandler, tokenStore } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth-store';
import type { AuthProfile } from '@/lib/types';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Auth and validation failures will never succeed on a retry.
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        onError: (error) => {
          const message =
            error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
          toast.error(message);
        },
      },
    },
  });
}

/** Restores the session on first paint so refreshes keep the user signed in. */
function SessionLoader({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const setInitialised = useAuthStore((state) => state.setInitialised);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      useAuthStore.setState({ user: null, initialised: true });
      toast.error('Your session has expired. Please sign in again.');
      router.replace('/login');
    });
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!tokenStore.access) {
        setInitialised(true);
        return;
      }
      try {
        const profile = await getOne<AuthProfile>('/auth/me');
        if (!cancelled) setUser(profile);
      } catch {
        tokenStore.clear();
        if (!cancelled) setUser(null);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [setUser, setInitialised]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionLoader>{children}</SessionLoader>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{ duration: 4000 }}
      />
    </QueryClientProvider>
  );
}

export { queryKeys };
