import { useEffect, useRef, useState } from 'react';

/** Embedded frames take scroll and drag only after a click; a tap or click outside, or Escape, releases them. */
export function useClickToEngage<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [engaged, setEngaged] = useState(false);
  useEffect(() => {
    if (!engaged) return;
    const release = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setEngaged(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setEngaged(false); };
    document.addEventListener('pointerdown', release);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', release); document.removeEventListener('keydown', escape); };
  }, [engaged]);
  return { ref, engaged, engage: () => setEngaged(true), release: () => setEngaged(false) };
}
