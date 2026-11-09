import type { CreateRoutineBlockInput, CreateRoutineOverrideInput, CreateWeekTemplateInput, RoutineBlock, RoutineOverride, UpdateRoutineBlockInput, UpdateRoutineOverrideInput, UpdateWeekTemplateInput, WeekTemplate } from '@todo/shared';
import { routineBlocksApi, routineOverridesApi, weekTemplatesApi } from '../api/entities';
import { createEntityHooks } from './entityHooks';

export const weekTemplateHooks = createEntityHooks<WeekTemplate, CreateWeekTemplateInput, UpdateWeekTemplateInput>('week-templates', weekTemplatesApi);
export const routineBlockHooks = createEntityHooks<RoutineBlock, CreateRoutineBlockInput, UpdateRoutineBlockInput>('routine-blocks', routineBlocksApi);
export const routineOverrideHooks = createEntityHooks<RoutineOverride, CreateRoutineOverrideInput, UpdateRoutineOverrideInput>('routine-overrides', routineOverridesApi);
