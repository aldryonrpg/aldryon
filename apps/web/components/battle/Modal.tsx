import { useEffect } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Centered in-screen overlay (not a browser popup) — a dark backdrop click,
 * Escape, or the X all close it. Used for panels that used to grow the page
 * inline (e.g. Attacks) and pushed the whole layout around.
 */
export function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-sm border border-white bg-black text-stone-100 shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-white px-3 py-2">
          <span className="font-bold">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="px-2 text-stone-300 hover:text-white"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
