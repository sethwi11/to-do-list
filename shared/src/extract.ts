/*
 * Finding events in text and in .ics files. A separate entry point (import from '@todo/shared/extract') because
 * the libraries behind it (chrono-node, ical.js) are large and only needed when someone imports a file, so the
 * app loads them on demand instead of with every page.
 */
export * from './eventExtractor';
export * from './icsImport';
