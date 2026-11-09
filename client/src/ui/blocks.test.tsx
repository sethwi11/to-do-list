import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BlockText } from './blocks';

const text = (minutes: number) => renderToStaticMarkup(<BlockText title="Drive home" detail="Personal" time="4:00–4:30 PM" minutes={minutes} />).replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');

describe('block text fits the block', () => {
  it('an hour or more: the title, then category and time', () => {
    expect(text(60)).toBe('|Drive home|Personal · |4:00–4:30 PM|');
  });
  it('30 to 59 minutes: one line, title and time', () => {
    expect(text(30)).toBe('|Drive home| · |4:00–4:30 PM|');
    expect(text(45)).toBe('|Drive home| · |4:00–4:30 PM|');
  });
  it('under 30 minutes: the title alone', () => {
    expect(text(20)).toBe('|Drive home|');
  });
});
