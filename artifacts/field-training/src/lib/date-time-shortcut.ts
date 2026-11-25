import { currentDateTimeMDY } from './training-calendar.js';

export type ShortcutKind = 'date' | 'time' | 'datetime';
type ShortcutEvent = {
  key: string;
  defaultPrevented?: boolean;
  nativeEvent?: { isComposing?: boolean };
  currentTarget: { value: string; readOnly?: boolean; disabled?: boolean; matches?(selector:string):boolean };
  preventDefault(): void;
};

/** Resolve only an explicit marker; Tab (including Shift+Tab) keeps native navigation. */
export function dateTimeShortcut(
  event: ShortcutEvent,
  kind: ShortcutKind,
  apply: (value: string) => void,
  fixedDate?: string,
): boolean {
  const input = event.currentTarget;
  if (event.defaultPrevented || event.nativeEvent?.isComposing || input.readOnly
    || input.disabled || input.matches?.(':disabled') || input.value.trim() !== '?'
    || (event.key !== 'Tab' && event.key !== 'Enter')) return false;
  const now = currentDateTimeMDY();
  const value = kind === 'date' ? now.date : kind === 'time' ? now.time : `${fixedDate ?? now.date} ${now.time}`;
  if (event.key === 'Enter') event.preventDefault();
  // Update the DOM as well as state so a repeated key before React commits cannot
  // resolve the same marker twice. The caller remains the owner of saved state.
  input.value = value;
  apply(value);
  return true;
}

// Keep the existing shared entry point while using one resolution implementation.
export const applyCurrentDateTimeShortcut = dateTimeShortcut;
