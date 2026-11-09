import type { CheckIn, CreateCheckInInput, CreateFocusSessionInput, FocusSession, UpdateCheckInInput } from '@todo/shared';
import { checkInsApi, focusSessionsApi } from '../api/entities';
import { createEntityHooks } from './entityHooks';

export const checkInHooks = createEntityHooks<CheckIn, CreateCheckInInput, UpdateCheckInInput>('check-ins', checkInsApi);
export const focusSessionHooks = createEntityHooks<FocusSession, CreateFocusSessionInput, never>('focus-sessions', focusSessionsApi);
