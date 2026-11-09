import type { CreateJournalEntryInput, JournalEntry, UpdateJournalEntryInput } from '@todo/shared';
import { journalApi } from '../api/entities';
import { createEntityHooks } from './entityHooks';

export const journalHooks = createEntityHooks<JournalEntry, CreateJournalEntryInput, UpdateJournalEntryInput>('journal', journalApi);
