import type { Course, CreateCourseInput, CreateSemesterInput, Semester, UpdateCourseInput, UpdateSemesterInput } from '@todo/shared';
import { coursesApi, semestersApi } from '../api/entities';
import { createEntityHooks } from './entityHooks';

export const courseHooks = createEntityHooks<Course, CreateCourseInput, UpdateCourseInput>('courses', coursesApi);
export const semesterHooks = createEntityHooks<Semester, CreateSemesterInput, UpdateSemesterInput>('semesters', semestersApi);
