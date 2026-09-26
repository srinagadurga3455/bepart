import { useQuery } from '@tanstack/react-query';
import { organizersApi } from '../account/api/organizers';
import { authApi } from '../../auth/api/auth';
import type { OrganizerItem, UserItem } from '../../app/types';

// Shared organizer identity (frontend only, live APIs only).
// Primary source is GET /organizers/me. When the backend has no organizer
// profile linked to this login (404 "Organizer profile not found"), fall back
// to GET /auth/me so pages can still show the authenticated user's account
// instead of a dead-end error. No mock data, no API changes.
export interface OrganizerIdentity {
  organizer: OrganizerItem | null;
  user: UserItem | null;
  isLoading: boolean;
  profileMissing: boolean;
}

export function useOrganizerIdentity(): OrganizerIdentity {
  const orgQuery = useQuery({
    queryKey: ['organizer', 'me'],
    queryFn: () => organizersApi.getMe(),
  });
  const organizer: OrganizerItem | null = orgQuery.data?.data ?? null;
  const settled = !orgQuery.isLoading;
  const needUser = settled && (!organizer || orgQuery.isError);
  const userQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    enabled: needUser,
  });
  const user: UserItem | null = userQuery.data?.data ?? null;

  return {
    organizer,
    user,
    isLoading: orgQuery.isLoading || (needUser && userQuery.isLoading),
    profileMissing: settled && (!organizer || orgQuery.isError),
  };
}
