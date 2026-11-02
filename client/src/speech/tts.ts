/*
 * Text-to-speech via the browser's SpeechSynthesis API: no server, no cost.
 * speak() returns a promise that resolves when speaking finishes, so callers
 * can pause the microphone while the app is talking. Otherwise, in
 * conversation mode, the app would transcribe its own voice.
 */

export const isTtsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text: string): Promise<void> {
  if (!isTtsSupported() || !text.trim()) return Promise.resolve();
  return new Promise((resolve) => {
    window.speechSynthesis.cancel(); // never queue up stale replies
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.lang = navigator.language || 'en-US';
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
    // Safety net: some browsers occasionally never fire onend.
    setTimeout(resolve, 2000 + text.length * 90);
  });
}

export function stopSpeaking(): void {
  if (isTtsSupported()) window.speechSynthesis.cancel();
}
