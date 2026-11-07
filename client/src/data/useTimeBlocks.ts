import type { CreateTimeBlockInput, TimeBlock, UpdateTimeBlockInput } from '@todo/shared';
import { timeBlocksApi } from '../api/entities';
import { createEntityHooks } from './entityHooks';

export const timeBlockHooks = createEntityHooks<TimeBlock, CreateTimeBlockInput, UpdateTimeBlockInput>('time-blocks', timeBlocksApi);
