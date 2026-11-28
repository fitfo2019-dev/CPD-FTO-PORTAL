import { forwardRef, useCallback, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

/** Text box that starts at `minRows` lines and grows to show everything typed, so long narratives never scroll inside a small box. */
export const AutoGrowTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }>(
  function AutoGrowTextarea({ minRows = 6, className = '', value, style, ...props }, forwardedRef) {
    const inner = useRef<HTMLTextAreaElement | null>(null);
    const fit = useCallback(() => {
      const element = inner.current;
      if (!element) return;
      element.style.height = 'auto';
      element.style.height = `${element.scrollHeight + element.offsetHeight - element.clientHeight}px`;
    }, []);
    useLayoutEffect(fit, [fit, value]);
    useLayoutEffect(() => {
      const element = inner.current;
      if (!element || typeof ResizeObserver === 'undefined') return;
      let width = element.clientWidth;
      const observer = new ResizeObserver(() => { if (element.clientWidth !== width) { width = element.clientWidth; fit(); } });
      observer.observe(element);
      return () => observer.disconnect();
    }, [fit]);
    return <textarea {...props} ref={element => {
      inner.current = element;
      if (typeof forwardedRef === 'function') forwardedRef(element);
      else if (forwardedRef) forwardedRef.current = element;
    }} rows={minRows} value={value} style={{ ...style, overflowY: 'hidden', resize: 'none', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} className={className}/>;
  });
