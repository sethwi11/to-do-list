import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

let loading: Promise<typeof import('pdfjs-dist')> | null = null;

/** pdf.js, loaded the first time it's needed (it is big) and pointed at its worker file, which the build serves as a normal asset. */
export function loadPdfjs() {
  return (loading ??= (async () => {
    const pdfjs = await import('pdfjs-dist');
    const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
  })());
}

/** Open a PDF from its bytes. (pdf.js takes ownership of the array it's given, so hand it a copy if you still need yours.) */
export async function openPdf(bytes: ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  return pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
}

/** Draw one page onto a canvas at the given scale (1 = 72 dpi; 2 is good for reading scanned text). */
export async function renderPage(page: PDFPageProxy, scale: number, canvas: HTMLCanvasElement): Promise<void> {
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas }).promise;
}
