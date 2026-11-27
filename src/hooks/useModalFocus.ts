import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export function useModalFocus(open: boolean, onClose: () => void, ref: RefObject<HTMLElement | null>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const modal = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = modal ? Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector)) : [];
    const preferred = modal?.querySelector<HTMLElement>('[autofocus]') || null;
    const first = preferred && focusables.includes(preferred) ? preferred : focusables[0] || modal;
    first?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !modal) return;
      const items = Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector));
      if (!items.length) {
        event.preventDefault();
        modal.focus();
        return;
      }
      const current = document.activeElement;
      if (event.shiftKey && (current === items[0] || !modal.contains(current))) {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (!event.shiftKey && current === items[items.length - 1]) {
        event.preventDefault();
        items[0].focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open, ref]);
}
