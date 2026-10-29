import { type RefObject, useEffect } from 'react';

// Brave on iOS lays its address bar over the page just above the keyboard, and visualViewport
// does not count it. 28px is measured from a screenshot of Brave 1.x on an iPhone.
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const KEYBOARD_BAR = IOS && 'brave' in navigator ? 28 : 0;

// Ported from reader-hero's library view. With the keyboard up the phone layout takes only the
// visible area, so the till stays above the keyboard and the paper above the till.
// active: the root only exists on phones; the listeners attach when it mounts.
export function useKeyboardFit(rootRef: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const root = rootRef.current;
    const viewport = window.visualViewport;

    if (root === null || viewport === null) return;

    const html = document.documentElement;
    let isTyping = false;
    const fit = () => {
      root.style.height = isTyping ? `${viewport.height - KEYBOARD_BAR}px` : '';

      // iOS scrolls the window. Its viewport offset lags behind and stays stale for a while after the close.
      const shift = isTyping ? Math.max(window.scrollY, viewport.offsetTop) : window.scrollY;

      root.style.top = shift > 0 ? `${shift}px` : '';
      // The page is no taller than what shows and does not scroll, so iOS has less to move.
      html.style.height = isTyping ? `${viewport.height}px` : '';
      html.style.overflow = isTyping ? 'hidden' : '';

      // The root's clientHeight stays the full screen with the keyboard up. InnerHeight shrinks with it.
      const covered = html.clientHeight - viewport.height;

      if (isTyping && covered > 0) {
        try {
          localStorage.setItem('keyboard-height', String(covered));
        } catch {
          // Without storage, the next focus shrinks the layout only once the keyboard is up.
        }
      }
    };
    const onFocus = (event: FocusEvent) => {
      isTyping = event.type === 'focusin' && (event.target as Element).matches('input, textarea');

      const known = (() => {
        try {
          return Number(localStorage.getItem('keyboard-height') ?? 0);
        } catch {
          return 0;
        }
      })();

      // Shrunk before iOS opens the keyboard, the field is already in view, so iOS does not move the page.
      if (isTyping && known > 0 && html.clientHeight - viewport.height < 1) {
        root.style.height = `${html.clientHeight - known - KEYBOARD_BAR}px`;
        html.style.height = `${html.clientHeight - known}px`;
        html.style.overflow = 'hidden';
      } else {
        fit();
      }
    };

    root.addEventListener('focusin', onFocus);
    root.addEventListener('focusout', onFocus);
    viewport.addEventListener('resize', fit);
    viewport.addEventListener('scroll', fit);
    window.addEventListener('scroll', fit);

    return () => {
      root.removeEventListener('focusin', onFocus);
      root.removeEventListener('focusout', onFocus);
      viewport.removeEventListener('resize', fit);
      viewport.removeEventListener('scroll', fit);
      window.removeEventListener('scroll', fit);
    };
  }, [rootRef, active]);
}
