import {useEffect} from 'react';

export function useMobileMenuSwipe(open: boolean, setOpen: (value: boolean) => void) {
  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 860px)');
    let gesture: {id: number; x: number; y: number} | null = null;

    function start(event: TouchEvent) {
      gesture = null;
      if (!mobile.matches || event.touches.length !== 1 || document.querySelector('.modal-backdrop')) return;
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('.app-shell')) return;
      if (target.closest('input, textarea, select, [contenteditable], .drag-handle, [role="slider"]')) return;

      const touch = event.touches[0];
      if (open ? !target.closest('.app-sidebar, .sidebar-scrim') : touch.clientX > 40) return;
      gesture = {id: touch.identifier, x: touch.clientX, y: touch.clientY};
    }

    function move(event: TouchEvent) {
      if (!gesture) return;
      const touch = event.touches[0];
      if (event.touches.length !== 1 || touch.identifier !== gesture.id) {
        gesture = null;
        return;
      }
      const horizontal = Math.abs(touch.clientX - gesture.x);
      const vertical = Math.abs(touch.clientY - gesture.y);
      if (vertical > 14 && vertical >= horizontal) gesture = null;
    }

    function end(event: TouchEvent) {
      if (!gesture) return;
      const start = gesture;
      gesture = null;
      const touch = Array.from(event.changedTouches).find(item => item.identifier === start.id);
      if (!touch) return;
      const distance = (touch.clientX - start.x) * (open ? -1 : 1);
      if (distance >= 52 && distance > 1.5 * Math.abs(touch.clientY - start.y)) setOpen(!open);
    }

    function cancel() { gesture = null; }

    window.addEventListener('touchstart', start, {passive: true});
    window.addEventListener('touchmove', move, {passive: true});
    window.addEventListener('touchend', end, {passive: true});
    window.addEventListener('touchcancel', cancel, {passive: true});
    return () => {
      window.removeEventListener('touchstart', start);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', cancel);
    };
  }, [open, setOpen]);
}
