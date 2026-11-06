/*
 * Which files the app can take, and what to say about the ones it can't.
 */

/** The most one file may be. (The server enforces the same limit; checking here gives the message before a slow upload.) */
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export type FileKind = 'image' | 'pdf' | 'docx' | 'text' | 'ics';

/** The parts of a File this file needs (so it can be tested without a browser). */
export interface FileLike {
  name: string;
  size: number;
  type?: string;
}

const KIND_BY_EXTENSION: Record<string, FileKind> = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  heic: 'image',
  heif: 'image',
  pdf: 'pdf',
  docx: 'docx',
  txt: 'text',
  ics: 'ics',
};

/** The value for <input accept>: what the file picker should offer. */
export const ACCEPT = '.png,.jpg,.jpeg,.webp,.heic,.heif,.pdf,.docx,.txt,.ics';

/** Formats we can name and give a "convert it" hint for. */
const CONVERTIBLE = new Set(['doc', 'pages', 'odt', 'rtf', 'key', 'ppt', 'pptx', 'numbers', 'xls', 'xlsx', 'gif', 'bmp', 'tif', 'tiff']);

const extensionOf = (name: string) => (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '');

/** What kind of file this is, or null if the app can't read it. */
export function kindOf(file: FileLike): FileKind | null {
  return KIND_BY_EXTENSION[extensionOf(file.name)] ?? null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A message fit to show if the file can't be used, or null if it's fine. */
export function fileProblem(file: FileLike): string | null {
  const ext = extensionOf(file.name);
  if (!kindOf(file)) {
    if (CONVERTIBLE.has(ext)) return `“${file.name}” is a .${ext} file, which this app can’t read. Save or export it as a PDF or .docx and try again.`;
    return `“${file.name}” can’t be read. Use an image (PNG, JPG, WEBP), a PDF, a .docx, a .txt, or a calendar (.ics) file.`;
  }
  if (file.size === 0) return `“${file.name}” is empty.`;
  if (file.size > MAX_FILE_BYTES) return `“${file.name}” is ${formatBytes(file.size)}. The most that can be added is ${formatBytes(MAX_FILE_BYTES)}.`;
  return null;
}
