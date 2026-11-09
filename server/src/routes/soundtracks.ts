import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Router } from 'express';
import type { SettingsRepository } from '../repositories/SqliteSettingsRepository';

const AUDIO = new Set(['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac', '.opus']);

/** The audio files in a soundtrack's folder on this Mac, played by the app (only when you press play; nothing is copied). */
export function soundtracksRouter(settings: SettingsRepository): Router {
  const router = Router();

  async function folderOf(name: string): Promise<string | null> {
    const folder = (await settings.get()).soundtracks.find((s) => s.name === name)?.folder;
    if (!folder) return null;
    const dir = folder.startsWith('~') ? path.join(os.homedir(), folder.slice(1)) : folder;
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? dir : null;
  }
  const tracksIn = (dir: string) => fs.readdirSync(dir).filter((f) => AUDIO.has(path.extname(f).toLowerCase()) && !f.startsWith('.')).sort();

  router.get('/:name/tracks', async (req, res) => {
    const dir = await folderOf(req.params.name);
    if (!dir) {
      res.status(404).json({ error: 'NotFound', message: 'This soundtrack has no folder of audio files, or the folder is gone.' });
      return;
    }
    res.json(tracksIn(dir));
  });

  router.get('/:name/tracks/:file', async (req, res) => {
    const dir = await folderOf(req.params.name);
    // Only a file that the folder listing would show: no paths, no other folders.
    if (!dir || !tracksIn(dir).includes(req.params.file)) {
      res.status(404).json({ error: 'NotFound', message: 'No such track.' });
      return;
    }
    res.sendFile(req.params.file, { root: dir });
  });

  return router;
}
