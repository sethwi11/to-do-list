import type { CreateRoutineBlockInput, CreateWeekTemplateInput, RoutineBlock, UpdateRoutineBlockInput, UpdateWeekTemplateInput, WeekTemplate } from '@todo/shared';
import { routineBlocksApi, weekTemplatesApi } from '../api/entities';
import { createEntityHooks } from './entityHooks';

export const weekTemplateHooks = createEntityHooks<WeekTemplate, CreateWeekTemplateInput, UpdateWeekTemplateInput>('week-templates', weekTemplatesApi);
export const routineBlockHooks = createEntityHooks<RoutineBlock, CreateRoutineBlockInput, UpdateRoutineBlockInput>('routine-blocks', routineBlocksApi);
