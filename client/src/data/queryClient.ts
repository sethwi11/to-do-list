import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';

/** The app's one cache of server data. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failures, error) => (error instanceof ApiError && error.status >= 400 && error.status < 500 ? false : failures < 2),
    },
    mutations: { retry: false },
  },
});

/** One place for every cache key, so a typo can't silently create a second cache. */
export const keys = {
  tasks: ['tasks'] as const,
  calendars: ['calendars'] as const,
  events: ['events'] as const,
  eventTypes: ['event-types'] as const,
};
