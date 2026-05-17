import { useEffect } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  // Centered overlay panel — matches the rest of the dashboard's chrome
  // (rounded-2xl card, backdrop-blur, header + scrollable body + optional
  // footer). Use for form-style settings; ConfirmDialog stays the right
  // pick for short yes/no prompts.
  children: React.ReactNode;
  footer?: React.ReactNode;
  // Default max-width is "lg" (~512px). Bump up only when the form really
  // needs more horizontal room.
  maxWidth?: "md" | "lg" | "xl" | "2xl";
};

const WIDTH_CLASS: Record<NonNullable<Props["maxWidth"]>, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

export const Modal = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = "lg",
}: Props) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl border border-gray-200 shadow-xl w-full ${WIDTH_CLASS[maxWidth]} max-h-[92vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-50 shrink-0"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/60">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
