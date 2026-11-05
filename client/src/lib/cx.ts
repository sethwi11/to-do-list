/** Joins class names, skipping anything falsy: cx('a', isOn && 'b') -> "a b" or "a". */
export const cx = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(' ');
