import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_SETTINGS, type Application, type CreateApplicationInput, type CreateTemplateInput, type Template, type UpdateApplicationInput, type UpdateSettingsInput, type UpdateTemplateInput } from '@todo/shared';
import { applicationsApi, settingsApi, templatesApi } from '../api/entities';
import { createEntityHooks } from './entityHooks';

export const applicationHooks = createEntityHooks<Application, CreateApplicationInput, UpdateApplicationInput>('applications', applicationsApi);
export const templateHooks = createEntityHooks<Template, CreateTemplateInput, UpdateTemplateInput>('templates', templatesApi);

const SETTINGS_KEY = ['settings'] as const;

/**
 * The settings that belong to your data (the offer goal and its date, the focus timer, ...), kept on the server so they
 * follow your data. Per-device preferences such as the theme live in the browser instead (see useSettings).
 * Until the server answers, the defaults stand in.
 */
export function useAppSettings() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: settingsApi.get });
  const mutation = useMutation({
    mutationFn: (changes: UpdateSettingsInput) => settingsApi.update(changes),
    onSuccess: (saved) => qc.setQueryData(SETTINGS_KEY, saved),
  });
  return { settings: query.data ?? DEFAULT_SETTINGS, loading: query.isPending, update: mutation.mutateAsync, saving: mutation.isPending };
}
