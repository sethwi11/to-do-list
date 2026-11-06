import { describe, expect, it } from 'vitest';
import { fileProblem, formatBytes, kindOf, MAX_FILE_BYTES } from './fileTypes';

const file = (name: string, size = 1000) => ({ name, size });

describe('kindOf', () => {
  it('recognises what it can read, whatever the case', () => {
    expect(kindOf(file('shot.PNG'))).toBe('image');
    expect(kindOf(file('photo.jpeg'))).toBe('image');
    expect(kindOf(file('IMG_1.HEIC'))).toBe('image');
    expect(kindOf(file('syllabus.pdf'))).toBe('pdf');
    expect(kindOf(file('notes.docx'))).toBe('docx');
    expect(kindOf(file('a.txt'))).toBe('text');
    expect(kindOf(file('cal.ics'))).toBe('ics');
  });
  it('returns null for the rest', () => {
    expect(kindOf(file('old.doc'))).toBeNull();
    expect(kindOf(file('noextension'))).toBeNull();
  });
});

describe('fileProblem', () => {
  it('accepts a normal file', () => {
    expect(fileProblem(file('syllabus.pdf'))).toBeNull();
  });
  it('tells you to convert formats it cannot read', () => {
    expect(fileProblem(file('old.doc'))).toMatch(/PDF or \.docx/);
    expect(fileProblem(file('notes.pages'))).toMatch(/PDF or \.docx/);
  });
  it('explains an unknown type by listing what works', () => {
    expect(fileProblem(file('thing.xyz'))).toMatch(/PNG, JPG, WEBP/);
  });
  it('rejects an empty file and one over the limit, with sizes', () => {
    expect(fileProblem(file('a.pdf', 0))).toMatch(/empty/);
    expect(fileProblem(file('big.pdf', MAX_FILE_BYTES + 1))).toMatch(/15\.0 MB/);
    expect(fileProblem(file('exact.pdf', MAX_FILE_BYTES))).toBeNull();
  });
});

describe('formatBytes', () => {
  it('uses B, KB and MB', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
