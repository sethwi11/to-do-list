import type { Badge, CreateBadgeInput, CreateMilestoneInput, CreateWeeklyReviewInput, Milestone, UpdateMilestoneInput, UpdateWeeklyReviewInput, WeeklyReview } from '@todo/shared';
import { badgesApi, milestonesApi, weeklyReviewsApi } from '../api/entities';
import { createEntityHooks } from './entityHooks';

export const milestoneHooks = createEntityHooks<Milestone, CreateMilestoneInput, UpdateMilestoneInput>('milestones', milestonesApi);
export const badgeHooks = createEntityHooks<Badge, CreateBadgeInput, never>('badges', badgesApi);
export const weeklyReviewHooks = createEntityHooks<WeeklyReview, CreateWeeklyReviewInput, UpdateWeeklyReviewInput>('weekly-reviews', weeklyReviewsApi);
