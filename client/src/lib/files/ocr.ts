import type { Worker } from 'tesseract.js';

/*
 * Reading text out of pictures, entirely inside this browser tab. The worker script, the engine and the
 * English language data are all served from this app's own address (see selfHostedOcr in vite.config.ts), so no
 * picture, and nothing about it, ever leaves the computer. The first use downloads about 6 MB of language
 * data from the app itself and keeps it in the browser's storage afterwards.
 */

export interface Ocr {
  /** Resolves to the text found. `onProgress` is called with 0..1 while it works. */
  recognize(image: Blob | HTMLCanvasElement, onProgress: (fraction: number) => void): Promise<string>;
  terminate(): Promise<void>;
}

const here = (path: string) => new URL(path, window.location.href).href;

/** One shared OCR worker per import: starting one is the slow part, so it is made on first use and reused for every page and file. */
export function createOcr(): Ocr {
  let worker: Promise<Worker> | null = null;
  let report: (fraction: number) => void = () => {};

  const get = () =>
    (worker ??= import('tesseract.js').then(({ createWorker }) =>
      createWorker('eng', 1, {
        workerPath: here('/ocr/worker.min.js'),
        corePath: here('/ocr/core'),
        langPath: here('/ocr/lang'),
        logger: (m) => {
          if (m.status === 'recognizing text') report(m.progress);
        },
      }),
    ));

  return {
    async recognize(image, onProgress) {
      const w = await get();
      report = onProgress;
      const { data } = await w.recognize(image);
      return data.text;
    },
    async terminate() {
      if (!worker) return;
      const w = await worker;
      worker = null;
      await w.terminate();
    },
  };
}

/** Photos can be 12 megapixels; reading text from one that big is slow and no more accurate than from a 2600-pixel one. */
const MAX_SIDE = 2600;
/**
 * The other way round: small text in a small picture (a low-resolution screenshot) is hard for OCR, which wants letters about
 * 20+ pixels tall. Enlarging it first, smoothly, helps a lot. Never more than 3x.
 */
const MIN_SIDE = 1800;
const MAX_ENLARGE = 3;

/** How much to scale a picture of this size before reading it: down if huge, up if small, 1 if it's fine. */
export function ocrScale(width: number, height: number): number {
  const longest = Math.max(width, height);
  if (longest > MAX_SIDE) return MAX_SIDE / longest;
  if (longest < MIN_SIDE) return Math.min(MAX_ENLARGE, MIN_SIDE / longest);
  return 1;
}

/**
 * Open an image as something the OCR can read. Going through the browser's own image decoder also
 * turns HEIC photos into pixels where the browser supports them (Safari does; most others don't), and
 * gives a clear message where it can't.
 */
export async function imageToCanvas(file: File): Promise<HTMLCanvasElement> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    const heic = /\.hei[cf]$/i.test(file.name);
    throw new Error(heic ? `This browser can’t open HEIC photos. Convert “${file.name}” to JPG or PNG first (on a Mac, open it in Preview and choose File > Export).` : `“${file.name}” couldn’t be opened as an image. It may be damaged.`);
  }
  const scale = ocrScale(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}
