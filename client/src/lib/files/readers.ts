import { fileProblem, kindOf, type FileKind } from './fileTypes';
import { imageToCanvas, type Ocr } from './ocr';
import { openPdf, renderPage } from './pdf';
import { textFromItems, type PdfTextItem } from './pdfText';

/** What reading a file produced. */
export interface ReadResult {
  kind: FileKind;
  text: string;
  /** For a PDF: where each page starts in `text`, so a date can be traced to its page. */
  pageStarts: number[] | null;
  pageCount: number | null;
  /** Some text came from OCR (a picture, or a scanned page) and may have mistakes. */
  usedOcr: boolean;
}

export interface Progress {
  /** What's happening now, in words: "Reading page 2 of 6…". */
  step: string;
  /** 0..1 if known. */
  fraction: number | null;
}

/** A PDF page with less text than this (letters and digits) is treated as a scan and read with OCR. */
export const SCANNED_PAGE_CHARS = 25;

const nonSpace = (s: string) => s.replace(/\s+/g, '').length;

/** Get the text out of a file, whatever it is. */
export async function readFileText(file: File, ocr: Ocr, onProgress: (p: Progress) => void): Promise<ReadResult> {
  const problem = fileProblem(file);
  if (problem) throw new Error(problem);
  const kind = kindOf(file)!;
  onProgress({ step: 'Reading file…', fraction: null });

  switch (kind) {
    case 'text':
    case 'ics':
      return { kind, text: await file.text(), pageStarts: null, pageCount: null, usedOcr: false };

    case 'docx': {
      const mammoth = await import('mammoth');
      const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() }).catch(() => {
        throw new Error(`“${file.name}” couldn’t be read as a Word document. It may be damaged, or an older .doc file renamed to .docx.`);
      });
      return { kind, text: value, pageStarts: null, pageCount: null, usedOcr: false };
    }

    case 'image': {
      onProgress({ step: 'Reading text from the picture…', fraction: 0 });
      const canvas = await imageToCanvas(file);
      const text = await ocr.recognize(canvas, (f) => onProgress({ step: 'Reading text from the picture…', fraction: f }));
      return { kind, text, pageStarts: null, pageCount: null, usedOcr: true };
    }

    case 'pdf': {
      const doc = await openPdf(await file.arrayBuffer()).catch(() => {
        throw new Error(`“${file.name}” couldn’t be opened as a PDF. It may be damaged or password-protected.`);
      });
      const pageCount = doc.numPages;
      const pages: string[] = [];
      let usedOcr = false;
      for (let n = 1; n <= doc.numPages; n++) {
        onProgress({ step: `Reading page ${n} of ${doc.numPages}…`, fraction: (n - 1) / doc.numPages });
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        const items = content.items.filter((i): i is typeof i & PdfTextItem => 'str' in i) as PdfTextItem[];
        let text = textFromItems(items);
        if (nonSpace(text) < SCANNED_PAGE_CHARS) {
          // Hardly any real text: this page is a picture of a page. Draw it and read it like any other picture.
          const step = `Reading scanned page ${n} of ${doc.numPages}…`;
          onProgress({ step, fraction: (n - 1) / doc.numPages });
          const canvas = document.createElement('canvas');
          await renderPage(page, 2, canvas);
          text = await ocr.recognize(canvas, (f) => onProgress({ step, fraction: (n - 1 + f) / doc.numPages }));
          usedOcr = true;
        }
        pages.push(text);
      }
      const pageStarts: number[] = [];
      let at = 0;
      for (const p of pages) {
        pageStarts.push(at);
        at += p.length + 2; // the blank line that joins pages
      }
      await doc.destroy();
      return { kind, text: pages.join('\n\n'), pageStarts, pageCount, usedOcr };
    }
  }
}

/** Which page (1-based) a position in the text falls on. */
export function pageAt(pageStarts: number[] | null, charIndex: number): number | null {
  if (!pageStarts) return null;
  let page = 1;
  pageStarts.forEach((start, i) => {
    if (charIndex >= start) page = i + 1;
  });
  return page;
}
