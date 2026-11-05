import type { Calendar, CreateCalendarInput, UpdateCalendarInput } from '@todo/shared';
import { calendarsApi } from '../api/entities';
import { createEntityHooks } from './entityHooks';
import { keys } from './queryClient';

export const calendarHooks = createEntityHooks<Calendar, CreateCalendarInput, UpdateCalendarInput>(keys.calendars[0], calendarsApi);
