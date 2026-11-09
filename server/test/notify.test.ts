import { describe, expect, it } from 'vitest';
import { clickCommand } from '../src/notify';

describe('what clicking a pop-up runs', () => {
  it('opens the page in the installed Planner window, so an open one is brought to the front', () => {
    expect(clickCommand('http://127.0.0.1:3030/checkin?date=2026-11-09', '/Users/me/Applications/Chrome Apps.localized/Planner.app')).toBe(
      "open -a '/Users/me/Applications/Chrome Apps.localized/Planner.app' 'http://127.0.0.1:3030/checkin?date=2026-11-09'",
    );
  });
  it('opens it in the browser when the app is not installed', () => {
    expect(clickCommand('http://127.0.0.1:3030/', null)).toBe("open 'http://127.0.0.1:3030/'");
  });
  it('quotes anything odd in a path or address, so it cannot run as part of the command', () => {
    expect(clickCommand("http://x/?a=b'; rm -rf ~; '", null)).toBe("open 'http://x/?a=b'\\''; rm -rf ~; '\\'''");
  });
});
