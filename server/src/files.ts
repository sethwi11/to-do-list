/*
 * What files may be uploaded, and how each is described when served back.
 *
 * The type is decided HERE, from the file's extension and its first few bytes, never from what the
 * browser claims. Whatever is stored is served with the type chosen below, so a file can't pose as
 * something else. SVG and HTML are deliberately absent: they can carry scripts.
 */

export interface FileKind {
  mime: string;
  /** Shown in the browser when opened (images, PDFs, text). Everything else is offered as a download. */
  inline: boolean;
  /** The file's first bytes must look like this, as a cheap check that it really is what it says. */
  signature?: (head: Buffer) => boolean;
}

const startsWith = (...bytes: number[]) => (head: Buffer) => bytes.every((b, i) => head[i] === b);

export const FILE_KINDS: Record<string, FileKind> = {
  png: { mime: 'image/png', inline: true, signature: startsWith(0x89, 0x50, 0x4e, 0x47) },
  jpg: { mime: 'image/jpeg', inline: true, signature: startsWith(0xff, 0xd8, 0xff) },
  jpeg: { mime: 'image/jpeg', inline: true, signature: startsWith(0xff, 0xd8, 0xff) },
  webp: { mime: 'image/webp', inline: true, signature: (h) => h.subarray(0, 4).toString('latin1') === 'RIFF' && h.subarray(8, 12).toString('latin1') === 'WEBP' },
  heic: { mime: 'image/heic', inline: false },
  heif: { mime: 'image/heif', inline: false },
  pdf: { mime: 'application/pdf', inline: true, signature: (h) => h.subarray(0, 5).toString('latin1') === '%PDF-' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', inline: false, signature: startsWith(0x50, 0x4b) },
  txt: { mime: 'text/plain; charset=utf-8', inline: true },
  ics: { mime: 'text/calendar; charset=utf-8', inline: false },
};

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** The lower-case extension without its dot ("Notes.PDF" -> "pdf"), or '' if there is none. */
export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}

/** A name safe to show and to put in a download header: no folders, no control characters, bounded length. */
export function cleanFilename(raw: string): string {
  // eslint-disable-next-line no-control-regex
  const base = raw.replace(/\\/g, '/').split('/').pop()!.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (base || 'file').slice(0, 200);
}
