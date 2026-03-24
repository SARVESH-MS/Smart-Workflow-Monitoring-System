import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const ANIMATION_MS = 220;

const Modal = ({ open, title, children, onClose }) => {
  const [mounted, setMounted] = useState(Boolean(open));
  const [visible, setVisible] = useState(Boolean(open));
  const closeTimerRef = useRef(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Next frame so transitions apply (avoid jumping to final state).
      requestAnimationFrame(() => setVisible(true));
      return undefined;
    }

    if (!mounted) return undefined;
    setVisible(false);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
    }, ANIMATION_MS);

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return undefined;

    // Lock background scroll (body + app scroll containers) while modal is mounted.
    // Use a simple ref-count to avoid breaking if multiple modals were ever shown.
    const count = Number(window.__swmsModalCount || 0) + 1;
    window.__swmsModalCount = count;

    if (count === 1) {
      window.__swmsPrevOverflow = {
        body: document.body.style.overflow,
        html: document.documentElement.style.overflow
      };
      document.body.classList.add("swms-modal-open");
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    return () => {
      const nextCount = Math.max(Number(window.__swmsModalCount || 1) - 1, 0);
      window.__swmsModalCount = nextCount;
      if (nextCount === 0) {
        const previous = window.__swmsPrevOverflow || { body: "", html: "" };
        delete window.__swmsPrevOverflow;
        document.body.classList.remove("swms-modal-open");
        document.body.style.overflow = previous.body;
        document.documentElement.style.overflow = previous.html;
      }
    };
  }, [mounted]);

  if (!mounted) return null;

  const handleOverlayPointerDown = (event) => {
    // Close only when the user clicks/taps the backdrop, not inside the modal.
    if (event.target !== event.currentTarget) return;
    onClose?.();
  };

  const modalUi = (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 sm:p-6 overflow-hidden overscroll-contain touch-none transition-opacity duration-200 ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onPointerDown={handleOverlayPointerDown}
      role="presentation"
    >
      <div
        className={`card w-full max-w-xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] flex min-h-0 flex-col overflow-hidden touch-auto transition-[transform,opacity] duration-200 ease-out ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.98] opacity-0"
        }`}
        role="dialog"
        aria-modal="true"
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          animation: "none",
          // `.card` overrides Tailwind transition utilities; force opacity + transform animation here.
          transition: `transform ${ANIMATION_MS}ms ease-out, opacity ${ANIMATION_MS}ms ease-out`
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="btn-ghost shrink-0" onClick={onClose}>Cancel</button>
        </div>
        <div className="mt-4 min-h-0 overflow-y-auto overscroll-contain thin-scrollbar pr-1 touch-pan-y">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalUi, document.body);
};

export default Modal;
